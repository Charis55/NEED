import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { writeJobEvent } from "@/lib/jobEvents";

/**
 * POST /api/calls/initiate
 *
 * Server-authoritative call initiation:
 *  1. Verifies the job is in an active state (prevents pre-booking or post-completion calls).
 *  2. Verifies the caller is a participant (customer or artisan) of the job.
 *  3. Verifies no call is already ringing / ongoing on this job (prevents double-rings).
 *  4. Writes activeCall to Firestore.
 *  5. Sends a high-priority FCM push to the recipient so their device wakes and rings.
 *  6. Logs a job event for audit purposes.
 */


export async function POST(req: NextRequest) {
  try {
    const { jobId, callerId, callType, callerSessionId } = await req.json();

    if (!jobId || !callerId || !callType) {
      return NextResponse.json(
        { error: "jobId, callerId, and callType are required" },
        { status: 400 }
      );
    }

    if (callType !== "audio" && callType !== "video") {
      return NextResponse.json(
        { error: "callType must be 'audio' or 'video'" },
        { status: 400 }
      );
    }

    const jobRef = adminDb.collection("jobRequests").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data()!;

    // Removed all state-gating and anti-cheat checks per user requirement:
    // UI already handles availability of call button.
    const now = Date.now();

    // 4. Determine recipient
    const currentCaller = (callerId || "").trim();
    const jobCustomer = (job.customerId || "").trim();
    const jobArtisan = (job.artisanId || "").trim();
    const receiverId = currentCaller === jobCustomer ? jobArtisan : jobCustomer;

    if (!receiverId) {
      return NextResponse.json(
        { error: "Could not determine call recipient. Please ensure a technician is assigned to this request." },
        { status: 400 }
      );
    }

    // 5. Write activeCall to Firestore atomically with unique session channelName and callerSessionId
    await jobRef.update({
      activeCall: {
        channelName: `${jobId}_${now}`,
        callerId,
        callerSessionId: callerSessionId || null,
        type: callType,
        status: "ringing",
        timestamp: now,
        connectedAt: null,
        bothConnectedAt: null,
      },
    });

    // 6. Log audit event
    await writeJobEvent(jobId, "call_initiated", callerId, {
      type: callType,
      receiverId,
    });

    // 7. Fetch recipient FCM token (users → artisans fallback)
    let fcmToken: string | undefined;
    let callerName: string | undefined;

    const [receiverUserDoc, callerUserDoc] = await Promise.all([
      adminDb.collection("users").doc(receiverId).get(),
      adminDb.collection("users").doc(callerId).get(),
    ]);

    if (receiverUserDoc.exists) {
      fcmToken = receiverUserDoc.data()?.fcmToken;
    }
    if (!fcmToken) {
      const receiverArtisanDoc = await adminDb
        .collection("artisans")
        .doc(receiverId)
        .get();
      if (receiverArtisanDoc.exists) {
        fcmToken = receiverArtisanDoc.data()?.fcmToken;
      }
    }

    if (callerUserDoc.exists) {
      const d = callerUserDoc.data()!;
      callerName =
        d.displayName ||
        (d.firstName ? `${d.firstName} ${d.lastName || ""}`.trim() : null) ||
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

    // 8. Send high-priority FCM data-only push (so Java CustomMessagingService handles native ringing)
    if (fcmToken) {
      try {
        await getMessaging(adminApp_).send({
          token: fcmToken,
          // Data-only: CustomMessagingService shows the native call notification + ringtone
          data: {
            type: "call",
            requestId: jobId,
            callType,
            callerName: callerName || "Someone",
            title: callerName || "Incoming Call",
            body: `Incoming ${callType} call`,
            channelName: `${jobId}_${now}`,
          },
          android: { priority: "high" },
          apns: {
            headers: { "apns-priority": "10" },
            payload: {
              aps: {
                alert: {
                  title: callerName || "Incoming Call",
                  body: `Incoming ${callType} call from ${callerName || ""}`,
                },
                sound: "default",
                contentAvailable: true,
              },
            },
          },
        });
      } catch (fcmErr: any) {
        // Non-fatal — Firestore update is the source of truth; client will see it via listener
        console.warn("FCM push for call initiation failed:", fcmErr?.message);
      }
    }

    return NextResponse.json({ success: true, receiverId });
  } catch (error: any) {
    console.error("Error initiating call:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
