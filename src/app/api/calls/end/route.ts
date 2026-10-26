import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { writeJobEvent } from "@/lib/jobEvents";
import { FieldValue } from "firebase-admin/firestore";
import { updateActiveCallStatus, getActiveCall } from "@/lib/callRegistry";

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
 *  1. Instantly updates in-memory callRegistry for sub-millisecond, quota-immune sync.
 *  2. Updates activeCall.status to "ended" in Firestore (resilient to quota).
 *  3. Appends a call log message to the job's messages subcollection.
 *  4. Sends a silent FCM push to the counterparty so their UI immediately reflects the ended call
 *     and Android/iOS dismisses ringing.
 *  5. If the call was missed (never connected), sends a "Missed Call" notification to the receiver.
 */

export async function POST(req: NextRequest) {
  try {
    const { jobId, callId, callerId, reason, durationMs } = await req.json();
    // reason: "ended" | "cancelled" | "declined" | "timeout"

    const targetJobId = jobId;
    if (!targetJobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const now = Date.now();
    const finalReason = reason || "ended";

    // 1. Immediately update in-memory registry (sub-millisecond, zero-quota)
    const inMemoryCall = updateActiveCallStatus(targetJobId, "ended", {
      endedAt: now,
      endedReason: finalReason,
    });

    let job: any = null;
    let activeCall = inMemoryCall;

    try {
      const jobRef = adminDb.collection("jobRequests").doc(targetJobId);
      const jobSnap = await jobRef.get();
      if (jobSnap.exists) {
        job = jobSnap.data()!;
        if (job.activeCall) {
          activeCall = { ...inMemoryCall, ...job.activeCall };
        }
      }
    } catch (dbReadErr: any) {
      console.warn("[calls/end] Firestore read warning (quota/offline):", dbReadErr?.message);
    }

    const isVideo = activeCall?.type === "video" || (activeCall as any)?.callType === "video";
    const syncConnectedAt = activeCall?.bothConnectedAt || activeCall?.connectedAt;
    const wasConnected = !!syncConnectedAt || finalReason === "ended" || (typeof durationMs === "number" && durationMs > 0);

    // Compute duration text based on synchronized time
    let durationText = "Missed Call";
    if (finalReason === "declined") {
      durationText = "Declined Call";
    } else if (finalReason === "cancelled") {
      durationText = "Cancelled";
    } else if (finalReason === "timeout") {
      durationText = "Missed Call";
    } else if (wasConnected || finalReason === "ended") {
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

    const messageText = `[CALL_LOG]:${isVideo ? "video" : "voice"}:${durationText}`;

    const effectiveCallerId = callerId || activeCall?.callerId;
    let messageSenderId = effectiveCallerId;
    let receiverId = activeCall?.receiverId;

    if (job) {
      if (finalReason === "declined") {
        messageSenderId = job.customerId === activeCall?.callerId ? job.artisanId : job.customerId;
      } else {
        messageSenderId = activeCall?.callerId || effectiveCallerId;
      }
      receiverId = job.customerId === messageSenderId ? job.artisanId : job.customerId;
    } else if (activeCall) {
      if (finalReason === "declined") {
        receiverId = activeCall.callerId;
      } else {
        receiverId = activeCall.receiverId;
      }
    }

    // 2. Safely attempt Firestore update & message log (never throw if quota is exceeded)
    try {
      const jobRef = adminDb.collection("jobRequests").doc(targetJobId);
      await jobRef.update({
        "activeCall.status": "ended",
        "activeCall.bothConnectedAt": null,
        "activeCall.connectedAt": null,
        "activeCall.endedAt": now,
        "activeCall.endedReason": finalReason,
        lastMessageText: messageText,
        lastMessageSenderId: messageSenderId || effectiveCallerId,
        lastMessageAt: now,
        ...(receiverId
          ? { [`unreadCount.${receiverId}`]: FieldValue.increment(1) }
          : {}),
      });

      await jobRef.collection("messages").add({
        text: messageText,
        senderId: messageSenderId || effectiveCallerId,
        createdAt: now,
      }).catch(() => {});

      if (receiverId && (activeCall?.callId || callId)) {
        adminDb
          .collection("users")
          .doc(receiverId)
          .collection("callInbox")
          .doc(activeCall?.callId || callId)
          .delete()
          .catch(() => {});
      }
    } catch (fsUpdateErr: any) {
      console.warn("[calls/end] Firestore update warning (quota/offline):", fsUpdateErr?.message);
    }

    // 3. Log job event
    try {
      await writeJobEvent(targetJobId, "call_ended", effectiveCallerId || "system", {
        reason: finalReason,
        wasConnected,
        durationText,
        type: isVideo ? "video" : "voice",
      });
    } catch {}

    // 4. Send silent FCM push to counterparty to immediately dismiss ringing on Android & iOS
    if (receiverId) {
      try {
        let receiverFcmToken: string | undefined;
        const [receiverUserDoc, receiverArtisanDoc] = await Promise.all([
          adminDb.collection("users").doc(receiverId).get().catch(() => null),
          adminDb.collection("artisans").doc(receiverId).get().catch(() => null),
        ]);

        if (receiverUserDoc && receiverUserDoc.exists) {
          receiverFcmToken = receiverUserDoc.data()?.fcmToken;
        }
        if (!receiverFcmToken && receiverArtisanDoc && receiverArtisanDoc.exists) {
          receiverFcmToken = receiverArtisanDoc.data()?.fcmToken;
        }

        if (receiverFcmToken) {
          // First: silent cancel push (wakes app immediately to cancel notification and dismiss modal)
          await getMessaging(adminApp_).send({
            token: receiverFcmToken,
            data: {
              type: "cancel_call",
              requestId: targetJobId,
              jobId: targetJobId,
              title: finalReason === "declined" ? "Call Declined" : "Call Ended",
              body: "",
              reason: finalReason,
            },
            android: { priority: "high" },
            apns: {
              headers: { "apns-priority": "10" },
              payload: { aps: { contentAvailable: true } },
            },
          });

          // Second: if caller cancelled or timed out without receiver answering, send missed call notification
          if (
            (finalReason === "timeout" || finalReason === "cancelled") &&
            !wasConnected
          ) {
            const callerDisplayName = activeCall?.callerName || "Someone";

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
        }
      } catch (fcmErr: any) {
        console.warn("[calls/end] FCM call end push warning:", fcmErr?.message);
      }
    }

    return NextResponse.json({ success: true, status: "ended", reason: finalReason }, { headers: corsHeaders });
  } catch (error: any) {
    console.warn("Non-fatal error in /api/calls/end:", error?.message);
    return NextResponse.json({ success: true, status: "ended" }, { headers: corsHeaders });
  }
}
