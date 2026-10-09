import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
    }

    const jobRef = adminDb.collection('jobRequests').doc(requestId);
    
    // We just set status to ended. The clients will pick this up and stop ringing/showing UI
    await jobRef.update({
      "activeCall.status": "ended",
      "lastMessageAt": Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error declining call:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
