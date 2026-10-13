import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { writeJobEvent } from "@/lib/jobEvents";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/calls/end
 *
 * Server-authoritative call termination:
 *  1. Updates activeCall.status to "ended" in Firestore.
 *  2. Appends a call log message to the job's messages subcollection.
 *  3. Sends a silent FCM push to the counterparty so their UI immediately reflects the ended call.
 *  4. If the call was missed (never connected), sends a "Missed Call" notification to the receiver.
 *  5. Logs a job event for audit.
 */

export async function POST(req: NextRequest) {
  try {
    const { jobId, callerId, reason, durationMs } = await req.json();
    // reason: "ended" | "cancelled" | "declined" | "timeout"

    if (!jobId || !callerId) {
      return NextResponse.json(
        { error: "jobId and callerId are required" },
        { status: 400 }
      );
    }

    const jobRef = adminDb.collection("jobRequests").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data()!;
    const activeCall = job.activeCall;

    if (!activeCall) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const isVideo = activeCall.type === "video";
    const wasConnected = !!activeCall.connectedAt;

    // Compute duration text
    let durationText = "Missed Call";
    if (wasConnected && typeof durationMs === "number" && durationMs > 0) {
      const totalSeconds = Math.floor(durationMs / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      durationText = `${m}:${s.toString().padStart(2, "0")} mins`;
    } else if (reason === "declined") {
      durationText = "Declined Call";
    } else if (reason === "cancelled") {
      durationText = "Cancelled";
    } else if (reason === "timeout") {
      durationText = "Missed Call";
    }

    const messageText = `[CALL_LOG]:${isVideo ? "video" : "voice"}:${durationText}`;

    // The message is attributed to the caller (for ended/cancelled/timeout)
    // or to the decliner (for declined)
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
      lastMessageText: messageText,
      lastMessageSenderId: messageSenderId || callerId,
      lastMessageAt: Date.now(),
      ...(receiverId
        ? { [`unreadCount.${receiverId}`]: FieldValue.increment(1) }
        : {}),
    });

    // 2. Append message to chat history
    try {
      await adminDb
        .collection("jobRequests")
        .doc(jobId)
        .collection("messages")
        .add({
          text: messageText,
          senderId: messageSenderId || callerId,
          createdAt: Date.now(),
        });
    } catch (msgErr) {
      console.warn("Failed to append call log message:", msgErr);
    }

    // 3. Log job event
    await writeJobEvent(jobId, "call_ended", callerId, {
      reason: reason || "ended",
      wasConnected,
      durationText,
      type: isVideo ? "video" : "voice",
    });

    // 4. Send silent FCM push to counterparty to immediately dismiss their ringing UI
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
          // First: silent cancel push (wakes app immediately to dismiss ringing)
          await getMessaging(adminApp_).send({
            token: receiverFcmToken,
            data: {
              type: "cancel_call",
              requestId: jobId,
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
            callerId === activeCall.callerId &&
            !wasConnected
          ) {
            // Look up caller name
            let callerName = "Someone";
            const callerUserDoc = await adminDb
              .collection("users")
              .doc(callerId)
              .get();
            if (callerUserDoc.exists) {
              const d = callerUserDoc.data()!;
              callerName =
                d.displayName ||
                (d.firstName
                  ? `${d.firstName} ${d.lastName || ""}`.trim()
                  : null) ||
                "Someone";
            } else {
              const callerArtisanDoc = await adminDb
                .collection("artisans")
                .doc(callerId)
                .get();
              if (callerArtisanDoc.exists) {
                const d = callerArtisanDoc.data()!;
                callerName = d.businessName || d.name || "Technician";
              }
            }

            await getMessaging(adminApp_).send({
              token: receiverFcmToken,
              notification: {
                title: "Missed Call",
                body: `Missed ${isVideo ? "video" : "voice"} call from ${callerName}`,
              },
              data: {
                type: "missed_call",
                requestId: jobId,
                title: "Missed Call",
                body: `Missed ${isVideo ? "video" : "voice"} call from ${callerName}`,
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
                      body: `Missed ${isVideo ? "video" : "voice"} call from ${callerName}`,
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error ending call:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
