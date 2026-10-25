import { NextResponse } from "next/server";
import pkg from "agora-token";

const RtcTokenBuilder = (pkg as any).RtcTokenBuilder || (pkg as any).default?.RtcTokenBuilder;
const RtcRole = (pkg as any).RtcRole || (pkg as any).default?.RtcRole;

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

    if (!RtcTokenBuilder || !RtcRole) {
      console.error("[agora/token] RtcTokenBuilder or RtcRole not resolved from agora-token package");
      return NextResponse.json({ error: 'Agora token builder module unavailable' }, { status: 500, headers: corsHeaders });
    }

    // If channelName corresponds to a jobId, log call event
    try {
      const { adminDb } = await import("@/lib/firebaseAdmin");
      const { writeJobEvent } = await import("@/lib/jobEvents");
      const jobSnap = await adminDb.collection("jobRequests").doc(channelName).get();
      if (jobSnap.exists) {
        await writeJobEvent(channelName, "call_started", uid, { channelName });
      }
    } catch (checkErr) {
      console.warn("Job call gating check skipped/failed:", checkErr);
    }

    // Role: Publisher for both sides (able to send and receive audio/video)
    const role = RtcRole.PUBLISHER;

    // Token expires in 2 hours (7200 seconds)
    const expirationTimeInSeconds = 7200;

    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      String(uid),
      role,
      expirationTimeInSeconds,
      expirationTimeInSeconds
    );

    return NextResponse.json({ token, joinUid: String(uid) }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Agora Token Generation Error:", error);
    return NextResponse.json({ error: error?.message || 'Failed to generate token' }, { status: 500, headers: corsHeaders });
  }
}
