import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

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

    const jobRef = adminDb.collection('jobRequests').doc(requestId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404, headers: corsHeaders });
    }

    const jobData = jobSnap.data()!;
    const activeCall = jobData.activeCall;

    // Guard: only transition to ongoing if the call is ringing
    if (!activeCall || activeCall.status !== 'ringing') {
      return NextResponse.json({ success: true, status: activeCall?.status || 'none' }, { headers: corsHeaders });
    }

    // Update Firestore so both caller and callee real-time listeners trigger
    await jobRef.update({
      'activeCall.status': 'ongoing',
      'activeCall.connectedAt': Date.now(),
      'activeCall.bothConnectedAt': null,
      'activeCall.acceptedBySession': sessionId,
      'activeCall.acceptedByDeviceId': deviceId,
      'activeCall.acceptedByPlatform': platform,
    });

    return NextResponse.json({ success: true, status: 'ongoing' }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error accepting call:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
