import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { writeJobEvent } from "@/lib/jobEvents";
import { FieldValue } from "firebase-admin/firestore";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/calls/end
 *
 * Server-authoritative call termination:
 *  1. Updates activeCall.status to "ended" in Firestore.
 *  2. Appends a call log message to the job's messages subcollection.
 *  3. Sends a silent FCM push to the counterparty so their UI immediately reflects the ended call
 *     and Android dismisses the persistent ringing notification.
 *  4. If the call was missed (never connected), sends a "Missed Call" notification to the receiver.
 *  5. Logs a job event for audit.
 */

export async function POST(req: NextRequest) {
  try {
    const { jobId, callerId, reason, durationMs } = await req.json();
    // reason: "ended" | "cancelled" | "declined" | "timeout"

    const targetJobId = jobId;
    if (!targetJobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const jobRef = adminDb.collection("jobRequests").doc(targetJobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404, headers: corsHeaders });
    }

    const job = jobSnap.data()!;
    const activeCall = job.activeCall;

    if (!activeCall) {
      return NextResponse.json({ success: true, skipped: true }, { headers: corsHeaders });
    }

    // Idempotency guard: If call has already been ended and logged, avoid duplicate messages
    if (activeCall.status === "ended") {
      return NextResponse.json({ success: true, skipped: true, reason: "already_ended" }, { headers: corsHeaders });
    }

    const isVideo = activeCall.type === "video" || activeCall.callType === "video";
    const syncConnectedAt = activeCall.bothConnectedAt || activeCall.connectedAt;
    const wasConnected = !!syncConnectedAt || reason === "ended" || (typeof durationMs === "number" && durationMs > 0);

    // Compute duration text based on synchronized time
    let durationText = "Missed Call";
    if (reason === "declined") {
      durationText = "Declined Call";
    } else if (reason === "cancelled") {
      durationText = "Cancelled";
    } else if (reason === "timeout") {
      durationText = "Missed Call";
    } else if (wasConnected || reason === "ended") {
      let finalDurationMs = 0;
      if (typeof durationMs === "number" && durationMs > 0) {
        finalDurationMs = durationMs;
      } else if (syncConnectedAt) {
        finalDurationMs = Math.max(0, Date.now() - syncConnectedAt);
      }
      const totalSeconds = Math.floor(finalDurationMs / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      durationText = `${m}:${s.toString().padStart(2, "0")} mins`;
    }

    const messageText = `[CALL_LOG]:${isVideo ? "video" : "voice"}:${durationText}`;

    const effectiveCallerId = callerId || activeCall.callerId;
    const messageSenderId =
      reason === "declined"
        ? (job.customerId === activeCall.callerId
            ? job.artisanId
            : job.customerId)
        : activeCall.callerId;

    const receiverId =
      job.customerId === messageSenderId ? job.artisanId : job.customerId;

    // 1. Update Firestore
    await jobRef.update({
      "activeCall.status": "ended",
      "activeCall.bothConnectedAt": null,
      "activeCall.connectedAt": null,
      "activeCall.endedAt": Date.now(),
      "activeCall.endedReason": reason || "ended",
      lastMessageText: messageText,
      lastMessageSenderId: messageSenderId || effectiveCallerId,
      lastMessageAt: Date.now(),
      ...(receiverId
        ? { [`unreadCount.${receiverId}`]: FieldValue.increment(1) }
        : {}),
    });

    // 2. Append message to chat history
    try {
      await adminDb
        .collection("jobRequests")
        .doc(targetJobId)
        .collection("messages")
        .add({
          text: messageText,
          senderId: messageSenderId || effectiveCallerId,
          createdAt: Date.now(),
        });
    } catch (msgErr) {
      console.warn("Failed to append call log message:", msgErr);
    }

    // 3. Log job event
    await writeJobEvent(targetJobId, "call_ended", effectiveCallerId || "system", {
      reason: reason || "ended",
      wasConnected,
      durationText,
      type: isVideo ? "video" : "voice",
    });

    // 4. Send silent FCM push to counterparty to immediately dismiss their ringing UI on Android & iOS
    if (receiverId) {
      let receiverFcmToken: string | undefined;
      const receiverUserDoc = await adminDb
        .collection("users")
        .doc(receiverId)
        .get();
      if (receiverUserDoc.exists) {
        receiverFcmToken = receiverUserDoc.data()?.fcmToken;
      }
      if (!receiverFcmToken) {
        const receiverArtisanDoc = await adminDb
          .collection("artisans")
          .doc(receiverId)
          .get();
        if (receiverArtisanDoc.exists) {
          receiverFcmToken = receiverArtisanDoc.data()?.fcmToken;
        }
      }

      if (receiverFcmToken) {
        try {
          // First: silent cancel push (wakes Android app immediately to cancel notification 1001)
          await getMessaging(adminApp_).send({
            token: receiverFcmToken,
            data: {
              type: "cancel_call",
              requestId: targetJobId,
              title: "Call Ended",
              body: "",
            },
            android: { priority: "high" },
            apns: {
              payload: { aps: { contentAvailable: true } },
            },
          });

          // Second: if caller cancelled or timed out without the receiver answering, send missed call notification
          if (
            (reason === "timeout" || reason === "cancelled") &&
            !wasConnected
          ) {
            let callerDisplayName = activeCall.callerName || "Someone";
            if (!callerDisplayName || callerDisplayName === "Someone") {
              const callerUserDoc = await adminDb.collection("users").doc(activeCall.callerId).get();
              if (callerUserDoc.exists) {
                const d = callerUserDoc.data()!;
                callerDisplayName = d.displayName || (d.firstName ? `${d.firstName} ${d.lastName || ""}`.trim() : null) || callerDisplayName;
              }
            }

            await getMessaging(adminApp_).send({
              token: receiverFcmToken,
              notification: {
                title: "Missed Call",
                body: `Missed ${isVideo ? "video" : "voice"} call from ${callerDisplayName}`,
              },
              data: {
                type: "missed_call",
                requestId: targetJobId,
                title: "Missed Call",
                body: `Missed ${isVideo ? "video" : "voice"} call from ${callerDisplayName}`,
              },
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                  channelId: "high_priority_alerts",
                },
              },
              apns: {
                payload: {
                  aps: {
                    alert: {
                      title: "Missed Call",
                      body: `Missed ${isVideo ? "video" : "voice"} call from ${callerDisplayName}`,
                    },
                    sound: "default",
                  },
                },
              },
            });
          }
        } catch (fcmErr: any) {
          console.warn("FCM call end push failed:", fcmErr?.message);
        }
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Error ending call:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
