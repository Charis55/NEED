import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { writeJobEvent } from "@/lib/jobEvents";
import { FieldValue } from "firebase-admin/firestore";
import {
  applyCallTransition,
  ActiveCall,
  CallAction,
  CallActor,
  isTerminalCallStatus,
} from "@/lib/callStateMachine";
import { updateActiveCallStatus } from "@/lib/callRegistry";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/calls/transition
 *
 * Single, server-authoritative call transition endpoint (Claude Section 2.3 & 2.4).
 * Serializes state updates in an atomic Firestore transaction.
 * Enforces monotonic revs and guarantees terminal states can never be resurrected.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = body.jobId || body.requestId;
    const callId = body.callId;
    const action = body.action as CallAction;
    const callerId = body.callerId || body.userId;
    const sessionId = body.sessionId;
    const reason = body.reason;
    const durationMs = body.durationMs;

    if (!jobId || !action) {
      return NextResponse.json(
        { error: "jobId and action are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const jobRef = adminDb.collection("jobRequests").doc(jobId);

    const transactionResult = await adminDb.runTransaction(async (t) => {
      const jobSnap = await t.get(jobRef);
      if (!jobSnap.exists) {
        return { error: "Job not found", status: 404 };
      }

      const jobData = jobSnap.data()!;
      const activeCall = jobData.activeCall as ActiveCall | undefined;

      if (!activeCall) {
        return { success: true, skipped: true, reason: "no_active_call" };
      }

      // If a specific callId is supplied, protect against operating on an already superseded call
      if (callId && activeCall.callId && activeCall.callId !== callId) {
        return { success: true, skipped: true, reason: "call_mismatch", currentCallId: activeCall.callId };
      }

      // Determine actor
      let actor: CallActor = "system";
      if (callerId) {
        if (callerId === activeCall.callerId) {
          actor = "caller";
        } else if (callerId === activeCall.receiverId) {
          actor = "callee";
        }
      } else if (body.actor === "caller" || body.actor === "callee") {
        actor = body.actor;
      } else if (action === "accept" || action === "decline") {
        actor = "callee";
      } else if (action === "cancel") {
        actor = "caller";
      } else if (action === "timeout" || action === "peerLost") {
        actor = "system";
      }

      const now = Date.now();
      const transitionResult = applyCallTransition(activeCall, action, actor, {
        now,
        sessionId,
        reason,
      });

      if (transitionResult.kind === "reject") {
        return { error: transitionResult.reason, status: 400 };
      }

      if (transitionResult.kind === "noop") {
        return {
          success: true,
          noop: true,
          reason: transitionResult.reason,
          activeCall,
        };
      }

      const nextCallData: Record<string, any> = {
        ...activeCall,
        ...transitionResult.next,
      };

      const jobUpdates: Record<string, any> = {
        activeCall: nextCallData,
      };

      const isTerminal = isTerminalCallStatus(transitionResult.next.status);

      // Handle chat log and counterparty updates on terminal states
      let messageText: string | null = null;
      let messageSenderId: string | null = null;
      let counterpartyId: string | null = null;

      if (isTerminal) {
        const isVideo = activeCall.type === "video" || (activeCall as any).callType === "video";
        const syncConnectedAt = activeCall.bothConnectedAt || activeCall.connectedAt;
        const isActionEnd = (action as string) === "end";
        const wasConnected = !!syncConnectedAt || isActionEnd || (typeof durationMs === "number" && durationMs > 0);
        let durationText = "Missed Call";
        if (action === "decline") {
          durationText = "Declined Call";
        } else if (action === "cancel") {
          durationText = "Cancelled";
        } else if (action === "timeout") {
          durationText = "Missed Call";
        } else if (wasConnected || isActionEnd) {
          let finalDurationMs = 0;
          if (typeof durationMs === "number" && durationMs > 0) {
            finalDurationMs = durationMs;
          } else if (syncConnectedAt) {
            finalDurationMs = Math.max(0, now - syncConnectedAt);
          }
          const totalSeconds = Math.floor(finalDurationMs / 1000);
          const m = Math.floor(totalSeconds / 60);
          const s = totalSeconds % 60;
          durationText = `${m}:${s.toString().padStart(2, "0")} mins`;
        }

        messageText = `[CALL_LOG]:${isVideo ? "video" : "voice"}:${durationText}`;
        messageSenderId =
          action === "decline"
            ? (jobData.customerId === activeCall.callerId ? jobData.artisanId : jobData.customerId)
            : activeCall.callerId;
        counterpartyId =
          jobData.customerId === messageSenderId ? jobData.artisanId : jobData.customerId;

        jobUpdates.lastMessageText = messageText;
        jobUpdates.lastMessageSenderId = messageSenderId || activeCall.callerId;
        jobUpdates.lastMessageAt = now;
        if (counterpartyId) {
          jobUpdates[`unreadCount.${counterpartyId}`] = FieldValue.increment(1);
        }
      }

      t.update(jobRef, jobUpdates);

      return {
        success: true,
        activeCall: nextCallData,
        messageText,
        messageSenderId,
        counterpartyId,
        isTerminal,
        callerId: activeCall.callerId,
        receiverId: activeCall.receiverId,
      };
    });

    if ("error" in transactionResult && transactionResult.error) {
      return NextResponse.json(
        { error: transactionResult.error },
        { status: transactionResult.status || 400, headers: corsHeaders }
      );
    }

    // Asynchronous side effects outside the transaction (logging, in-memory sync, & silent pushes)
    if (transactionResult.success && !transactionResult.skipped && !transactionResult.noop) {
      const {
        messageText,
        messageSenderId,
        counterpartyId,
        isTerminal,
        activeCall,
      } = transactionResult as any;

      // Sync server in-memory call registry immediately
      try {
        updateActiveCallStatus(
          jobId,
          isTerminal ? "ended" : "ongoing",
          activeCall
        );
      } catch (regErr) {
        console.warn("[calls/transition] in-memory registry sync warning:", regErr);
      }

      if (isTerminal && activeCall?.receiverId && activeCall?.callId) {
        adminDb
          .collection("users")
          .doc(activeCall.receiverId)
          .collection("callInbox")
          .doc(activeCall.callId)
          .delete()
          .catch(() => {});
      }

      if (isTerminal && messageText && messageSenderId) {
        // 1. Add chat message
        try {
          await adminDb.collection("jobRequests").doc(jobId).collection("messages").add({
            text: messageText,
            senderId: messageSenderId,
            createdAt: Date.now(),
          });
        } catch (msgErr) {
          console.warn("Failed to append call log message in transition:", msgErr);
        }

        // 2. Audit event
        writeJobEvent(jobId, "call_ended", messageSenderId, {
          reason: reason || action,
          callId: activeCall?.callId,
        }).catch(() => {});

        // 3. Send silent cancel push to counterparty so their ringing UI immediately stops
        if (counterpartyId) {
          try {
            let token: string | undefined;
            const uDoc = await adminDb.collection("users").doc(counterpartyId).get();
            if (uDoc.exists) token = uDoc.data()?.fcmToken;
            if (!token) {
              const aDoc = await adminDb.collection("artisans").doc(counterpartyId).get();
              if (aDoc.exists) token = aDoc.data()?.fcmToken;
            }

            if (token) {
              await getMessaging(adminApp_).send({
                token,
                data: {
                  type: "cancel_call",
                  requestId: jobId,
                  callId: activeCall?.callId || "",
                  title: "Call Ended",
                  body: "",
                },
                android: { priority: "high" },
                apns: {
                  payload: { aps: { contentAvailable: true } },
                },
              });
            }
          } catch (fcmErr: any) {
            console.warn("Silent FCM push in call transition failed:", fcmErr?.message);
          }
        }
      }
    }

    return NextResponse.json(transactionResult, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Error in /api/calls/transition:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
