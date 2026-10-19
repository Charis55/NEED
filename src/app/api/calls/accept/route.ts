import { NextRequest, NextResponse } from "next/server";
import { POST as transitionPOST } from "../transition/route";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const proxyReq = new NextRequest(new URL("/api/calls/transition", req.url), {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({
        jobId: body.requestId || body.jobId,
        action: "accept",
        sessionId: body.sessionId || "native-answer",
        callerId: body.userId || body.callerId,
      }),
    });
    return transitionPOST(proxyReq);
  } catch (error: any) {
    console.error("Error in /api/calls/accept:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
