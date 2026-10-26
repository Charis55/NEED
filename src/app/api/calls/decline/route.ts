import { NextResponse } from 'next/server';
import { adminDb, adminApp_ } from '@/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';
import { updateActiveCallStatus, getActiveCall } from '@/lib/callRegistry';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requestId = body.requestId || body.jobId;
    const providedCallerId = body.callerId || null;

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400, headers: corsHeaders });
    }

    const now = Date.now();

    // 1. Immediately update in-memory registry (sub-millisecond, zero-quota)
    const inMemoryCall = updateActiveCallStatus(requestId, "ended", {
      endedAt: now,
      endedReason: "declined",
    });

    let callerId = providedCallerId || inMemoryCall?.callerId;
    let jobData: any = null;

    // 2. Safely attempt Firestore update (never crash if quota is exceeded)
    try {
      const jobRef = adminDb.collection('jobRequests').doc(requestId);
      const jobSnap = await jobRef.get();
      if (jobSnap.exists) {
        jobData = jobSnap.data()!;
        if (!callerId) {
          callerId = jobData.activeCall?.callerId;
        }

        await jobRef.update({
          'activeCall.status': 'ended',
          'activeCall.endedAt': now,
          'activeCall.endedReason': 'declined',
          'lastMessageAt': now,
        });

        // Append chat log message
        const isVideo = jobData.activeCall?.type === 'video' || jobData.activeCall?.callType === 'video';
        const messageText = `[CALL_LOG]:${isVideo ? 'video' : 'voice'}:Declined Call`;
        const messageSenderId = jobData.customerId === callerId ? jobData.artisanId : jobData.customerId;
        await jobRef.collection('messages').add({
          text: messageText,
          senderId: messageSenderId || 'system',
          createdAt: now,
        }).catch(() => {});

        const receiverId = (body as any)?.declinedBy || (jobData.customerId === callerId ? jobData.artisanId : jobData.customerId);
        if (receiverId && (jobData.activeCall?.callId || (body as any)?.callId)) {
          adminDb
            .collection("users")
            .doc(receiverId)
            .collection("callInbox")
            .doc(jobData.activeCall?.callId || (body as any)?.callId)
            .delete()
            .catch(() => {});
        }
      }
    } catch (dbErr: any) {
      console.warn('[calls/decline] Firestore update warning (quota/offline):', dbErr?.message);
    }

    // 3. Send high-priority FCM push to CALLER so their ringing modal immediately stops and shows Declined
    if (callerId) {
      try {
        let callerFcmToken: string | undefined;
        const [callerUserDoc, callerArtisanDoc] = await Promise.all([
          adminDb.collection("users").doc(callerId).get().catch(() => null),
          adminDb.collection("artisans").doc(callerId).get().catch(() => null),
        ]);

        if (callerUserDoc && callerUserDoc.exists) {
          callerFcmToken = callerUserDoc.data()?.fcmToken;
        }
        if (!callerFcmToken && callerArtisanDoc && callerArtisanDoc.exists) {
          callerFcmToken = callerArtisanDoc.data()?.fcmToken;
        }

        if (callerFcmToken) {
          await getMessaging(adminApp_).send({
            token: callerFcmToken,
            data: {
              type: 'cancel_call',
              requestId,
              jobId: requestId,
              title: 'Call Declined',
              body: 'The other person declined your call.',
              reason: 'declined',
            },
            android: { priority: 'high' },
            apns: {
              headers: { "apns-priority": "10" },
              payload: { aps: { contentAvailable: true } },
            },
          });
        }
      } catch (fcmErr: any) {
        console.warn('[calls/decline] FCM push to caller failed:', fcmErr?.message);
      }
    }

    return NextResponse.json({ success: true, status: 'ended', reason: 'declined' }, { headers: corsHeaders });
  } catch (error: any) {
    console.warn('Non-fatal error in /api/calls/decline:', error?.message);
    return NextResponse.json({ success: true, status: 'ended' }, { headers: corsHeaders });
  }
}
