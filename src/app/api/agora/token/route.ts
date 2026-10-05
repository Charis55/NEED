import { NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS(req: Request) {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { channelName, uid } = await req.json();

    if (!channelName || !uid) {
      return NextResponse.json({ error: 'channelName and uid are required' }, { status: 400, headers: corsHeaders });
    }

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json({ error: 'Agora credentials not configured' }, { status: 500, headers: corsHeaders });
    }

    // Role: Publisher for both sides (able to send and receive audio/video)
    const role = RtcRole.PUBLISHER;

    // Token expires in 2 hours (7200 seconds)
    const expirationTimeInSeconds = 7200;

    // In agora-token v2, expiration is passed in seconds
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      uid, 
      role,
      expirationTimeInSeconds,
      expirationTimeInSeconds
    );

    return NextResponse.json({ token }, { headers: corsHeaders });
  } catch (error) {
    console.error("Agora Token Generation Error:", error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500, headers: corsHeaders });
  }
}
