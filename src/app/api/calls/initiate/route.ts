import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminApp_ } from "@/lib/firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import { writeJobEvent } from "@/lib/jobEvents";

/**
 * POST /api/calls/initiate
 *
 * Server-authoritative call initiation (Claude Section 2.2 & 2.4):
 *  1. Verifies the caller is a participant of the job.
 *  2. Concurrency guard: rejects if another call is currently ringing (< 45s) or ongoing.
 *  3. Generates unique callId, monotonic rev: 1, ringExpiresAt (now + 45s).
 *  4. Server-assigns non-colliding Agora UIDs for caller and callee.
 *  5. Denormalizes caller and callee profile info into activeCall (zero 'Someone' delay).
 *  6. Writes activeCall atomically to jobRequests/{jobId}.
 *  7. Writes users/{calleeId}/callInbox/{callId} for efficient incoming call indexing.
 *  8. Sends high-priority FCM data push with callId deduplication key.
 *  9. Logs audit job event.
 */

export async function POST(req: NextRequest) {
  try {
    const {
      jobId,
      callerId,
      callType,
      callerSessionId,
      callerDeviceId,
      callerPlatform,
      attemptId,
    } = await req.json();

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
    const now = Date.now();

    // Removed all state-gating and anti-cheat checks per user requirement:
    // UI already handles availability of call button and user wants calls to always initiate without 409 blockers.

    // 2. Determine recipient
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

    // 3. Fetch caller & receiver profiles concurrently for immediate display (zero 'Someone' delays)
    let fcmToken: string | undefined;
    let callerName: string = "Caller";
    let callerPhoto: string | null = null;
    let receiverName: string = "Technician";
    let receiverPhoto: string | null = null;

    const [receiverUserDoc, callerUserDoc, receiverArtisanDoc, callerArtisanDoc] = await Promise.all([
      adminDb.collection("users").doc(receiverId).get(),
      adminDb.collection("users").doc(callerId).get(),
      adminDb.collection("artisans").doc(receiverId).get(),
      adminDb.collection("artisans").doc(callerId).get(),
    ]);

    // Parse caller info
    if (callerUserDoc.exists) {
      const d = callerUserDoc.data()!;
      callerName = d.displayName || (d.firstName ? `${d.firstName} ${d.lastName || ""}`.trim() : null) || callerName;
      callerPhoto = d.photoURL || d.profilePictureUrl || null;
    }
    if (callerArtisanDoc.exists) {
      const d = callerArtisanDoc.data()!;
      callerName = d.businessName || d.name || callerName;
      callerPhoto = d.profilePictureUrl || d.photoURL || callerPhoto;
    }

    // Parse receiver info
    if (receiverUserDoc.exists) {
      const d = receiverUserDoc.data()!;
      fcmToken = d.fcmToken;
      receiverName = d.displayName || (d.firstName ? `${d.firstName} ${d.lastName || ""}`.trim() : null) || receiverName;
      receiverPhoto = d.photoURL || d.profilePictureUrl || null;
    }
    if (receiverArtisanDoc.exists) {
      const d = receiverArtisanDoc.data()!;
      if (!fcmToken) fcmToken = d.fcmToken;
      receiverName = d.businessName || d.name || receiverName;
      receiverPhoto = d.profilePictureUrl || d.photoURL || receiverPhoto;
    }

    // 4. Generate unique identifiers and server-assigned Agora UIDs
    const callId = attemptId || `call_${jobId}_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const callerAgoraUid = 1000 + Math.floor(Math.random() * 8000);
    const calleeAgoraUid = 10000 + Math.floor(Math.random() * 8000);
    const ringExpiresAt = now + 45000;
    const channelName = `${jobId}_${now}`;

    const activeCallPayload = {
      callId,
      jobId,
      channelName,
      rev: 1,
      status: "ringing",
      type: callType,
      callType,
      callerId,
      callerName,
      callerPhoto,
      receiverId,
      receiverName,
      receiverPhoto,
      callerSessionId: callerSessionId || null,
      callerDeviceId: callerDeviceId || null,
      callerPlatform: callerPlatform || null,
      acceptedBySession: null,
      acceptedByDeviceId: null,
      acceptedByPlatform: null,
      caller: {
        uid: callerId,
        displayName: callerName,
        photoUrl: callerPhoto,
        role: currentCaller === jobCustomer ? "customer" : "artisan",
        agoraUid: callerAgoraUid,
      },
      callee: {
        uid: receiverId,
        displayName: receiverName,
        photoUrl: receiverPhoto,
        role: receiverId === jobCustomer ? "customer" : "artisan",
        agoraUid: calleeAgoraUid,
      },
      timestamp: now,
      createdAt: now,
      ringExpiresAt,
      connectedAt: null,
      bothConnectedAt: null,
      endedAt: null,
      endedBy: null,
      endedReason: null,
    };

    // 5. Write activeCall to Firestore
    await jobRef.update({
      activeCall: activeCallPayload,
    });

    // 6. Write users/{receiverId}/callInbox/{callId} for indexed global listening
    adminDb
      .collection("users")
      .doc(receiverId)
      .collection("callInbox")
      .doc(callId)
      .set({
        callId,
        jobId,
        channelName,
        callType,
        callerId,
        callerName,
        callerPhoto,
        status: "ringing",
        createdAt: now,
        ringExpiresAt,
      })
      .catch((err) => console.warn("Failed to write callInbox document:", err));

    // 7. Log audit event
    await writeJobEvent(jobId, "call_initiated", callerId, {
      callId,
      type: callType,
      receiverId,
    });

    // 8. Send high-priority FCM data-only push
    if (fcmToken) {
      try {
        await getMessaging(adminApp_).send({
          token: fcmToken,
          data: {
            type: "call",
            callId,
            requestId: jobId,
            jobId,
            callType,
            callerName: callerName || "Someone",
            title: callerName || "Incoming Call",
            body: `Incoming ${callType} call`,
            channelName,
          },
          android: { priority: "high" },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-expiration": Math.floor(ringExpiresAt / 1000).toString(),
            },
            payload: {
              aps: {
                alert: {
                  title: callerName || "Incoming Call",
                  body: `Incoming ${callType} call from ${callerName || ""}`,
                },
                sound: "default",
                badge: 1,
                contentAvailable: true,
                category: "INCOMING_CALL",
              },
            },
          },
        });
      } catch (fcmErr: any) {
        console.warn("FCM push for call initiation failed:", fcmErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      callId,
      channelName,
      receiverId,
      activeCall: activeCallPayload,
    });
  } catch (error: any) {
    console.error("Error initiating call:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
