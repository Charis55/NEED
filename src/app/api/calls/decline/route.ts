import { NextResponse } from 'next/server';
import { adminDb, adminApp_ } from '@/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';

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

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400, headers: corsHeaders });
    }

    const jobRef = adminDb.collection('jobRequests').doc(requestId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404, headers: corsHeaders });
    }

    const jobData = jobSnap.data()!;
    const activeCall = jobData.activeCall;

    // Guard: allow declining if ringing OR if it was just set to 'ended' with 'declined' by native/client
    const isRinging = activeCall && activeCall.status === 'ringing';
    const wasJustDeclined = activeCall && activeCall.status === 'ended' && activeCall.endedReason === 'declined';
    if (!activeCall || (!isRinging && !wasJustDeclined)) {
      return NextResponse.json({ success: true, skipped: true }, { headers: corsHeaders });
    }

    const callerId = activeCall.callerId as string | undefined;

    // 1. Update Firestore so ALL clients (including caller) pick it up via real-time listener (if not already updated)
    if (activeCall.status !== 'ended') {
      await jobRef.update({
        'activeCall.status': 'ended',
        'activeCall.endedAt': Date.now(),
        'activeCall.endedReason': 'declined',
        'lastMessageAt': Date.now(),
      });
    }

    // 2. Append call log message to messages subcollection so chat reflects declined call
    const isVideo = activeCall.type === 'video';
    const messageText = `[CALL_LOG]:${isVideo ? 'video' : 'voice'}:Declined Call`;
    const messageSenderId = jobData.customerId === callerId ? jobData.artisanId : jobData.customerId;
    try {
      await jobRef.collection('messages').add({
        text: messageText,
        senderId: messageSenderId || 'system',
        createdAt: Date.now(),
      });
    } catch (msgErr) {
      console.warn('Failed to append call log message in decline:', msgErr);
    }

    // 3. Send a silent FCM push directly to the CALLER so their app wakes up immediately
    //    even if they are backgrounded and the Firestore listener is throttled.
    if (callerId) {
      let callerFcmToken: string | undefined;

      const callerUserDoc = await adminDb.collection('users').doc(callerId).get();
      if (callerUserDoc.exists) {
        callerFcmToken = callerUserDoc.data()?.fcmToken;
      }
      if (!callerFcmToken) {
        const callerArtisanDoc = await adminDb.collection('artisans').doc(callerId).get();
        if (callerArtisanDoc.exists) {
          callerFcmToken = callerArtisanDoc.data()?.fcmToken;
        }
      }

      if (callerFcmToken) {
        try {
          await getMessaging(adminApp_).send({
            token: callerFcmToken,
            // Data-only (silent) message — no notification shown, just wakes the app
            data: {
              type: 'cancel_call',
              requestId,
              title: 'Call Declined',
              body: 'The other person declined your call.',
            },
            android: { priority: 'high' },
            apns: {
              payload: { aps: { contentAvailable: true } },
            },
          });
        } catch (fcmErr: any) {
          // Non-fatal — Firestore update is the source of truth
          console.warn('FCM push to caller failed:', fcmErr?.message);
        }
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error declining call:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
