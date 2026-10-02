import { NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export async function POST(req: Request) {
  try {
    const { channelName, uid } = await req.json();

    if (!channelName || !uid) {
      return NextResponse.json({ error: 'channelName and uid are required' }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json({ error: 'Agora credentials not configured' }, { status: 500 });
    }

    // Role: Publisher for both sides (able to send and receive audio/video)
    const role = RtcRole.PUBLISHER;

    // Token expires in 2 hours (7200 seconds)
    const expirationTimeInSeconds = 7200;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // We use buildTokenWithAccount since Firebase UIDs are strings.
    const token = RtcTokenBuilder.buildTokenWithAccount(
      appId,
      appCertificate,
      channelName,
      uid, 
      role,
      privilegeExpiredTs,
      privilegeExpiredTs
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Agora Token Generation Error:", error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
