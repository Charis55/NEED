import { NextResponse } from 'next/server';
import { adminDb, adminApp_ } from '@/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';

export async function POST(req: Request) {
  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
    }

    const jobRef = adminDb.collection('jobRequests').doc(requestId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobSnap.data()!;
    const activeCall = jobData.activeCall;

    // Guard: only allow declining if the call is still ringing
    if (!activeCall || activeCall.status !== 'ringing') {
      return NextResponse.json({ success: true, skipped: true });
    }

    const callerId = activeCall.callerId as string | undefined;

    // 1. Update Firestore so ALL clients (including caller) pick it up via real-time listener
    await jobRef.update({
      'activeCall.status': 'ended',
      'lastMessageAt': Date.now(),
    });

    // 2. Send a silent FCM push directly to the CALLER so their app wakes up immediately
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error declining call:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
