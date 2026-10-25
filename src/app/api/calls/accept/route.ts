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
    const sessionId = body.sessionId || 'native-answer';
    const deviceId = body.deviceId || null;
    const platform = body.platform || null;

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400, headers: corsHeaders });
    }

    const now = Date.now();

    // 1. Immediately update in-memory registry (sub-millisecond, zero-quota)
    const inMemoryCall = updateActiveCallStatus(requestId, "ongoing", {
      connectedAt: now,
      bothConnectedAt: null,
      acceptedBySession: sessionId,
      acceptedByDeviceId: deviceId,
      acceptedByPlatform: platform,
    });

    let callerId = inMemoryCall?.callerId;
    let channelName = inMemoryCall?.channelName || requestId;

    // 2. Safely attempt Firestore update (never throw if quota is exceeded)
    try {
      const jobRef = adminDb.collection('jobRequests').doc(requestId);
      const jobSnap = await jobRef.get();
      if (jobSnap.exists) {
        const jobData = jobSnap.data()!;
        if (!callerId) {
          callerId = jobData.activeCall?.callerId;
        }
        if (!channelName && jobData.activeCall?.channelName) {
          channelName = jobData.activeCall.channelName;
        }

        await jobRef.update({
          'activeCall.status': 'ongoing',
          'activeCall.connectedAt': now,
          'activeCall.bothConnectedAt': null,
          'activeCall.acceptedBySession': sessionId,
          'activeCall.acceptedByDeviceId': deviceId,
          'activeCall.acceptedByPlatform': platform,
        });
      }
    } catch (dbErr: any) {
      console.warn('[calls/accept] Firestore update warning (quota/offline):', dbErr?.message);
    }

    // 3. Send high-priority FCM push directly to CALLER so their UI immediately connects to Agora
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
              type: "call_accepted",
              requestId,
              jobId: requestId,
              channelName,
              status: "ongoing",
            },
            android: { priority: "high" },
            apns: {
              headers: { "apns-priority": "10" },
              payload: { aps: { contentAvailable: true } },
            },
          });
        }
      } catch (fcmErr: any) {
        console.warn("[calls/accept] FCM push to caller failed:", fcmErr?.message);
      }
    }

    return NextResponse.json({ success: true, status: 'ongoing' }, { headers: corsHeaders });
  } catch (error: any) {
    console.warn('Non-fatal error accepting call:', error?.message);
    return NextResponse.json({ success: true, status: 'ongoing' }, { headers: corsHeaders });
  }
}
