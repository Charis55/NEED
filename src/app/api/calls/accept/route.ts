import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const requestId = body.requestId || body.jobId;
    const sessionId = body.sessionId || 'native-answer';

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

    // Guard: only transition to ongoing if the call is ringing
    if (!activeCall || activeCall.status !== 'ringing') {
      return NextResponse.json({ success: true, status: activeCall?.status || 'none' });
    }

    // Update Firestore so both caller and callee real-time listeners trigger
    await jobRef.update({
      'activeCall.status': 'ongoing',
      'activeCall.connectedAt': Date.now(),
      'activeCall.bothConnectedAt': null,
      'activeCall.acceptedBySession': sessionId,
    });

    return NextResponse.json({ success: true, status: 'ongoing' });
  } catch (error: any) {
    console.error('Error accepting call:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
