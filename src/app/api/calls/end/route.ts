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
    const reason = body.reason || "ended";
    let action: "cancel" | "decline" | "timeout" | "end" = "end";
    if (reason === "cancelled") action = "cancel";
    else if (reason === "declined") action = "decline";
    else if (reason === "timeout") action = "timeout";

    const proxyReq = new NextRequest(new URL("/api/calls/transition", req.url), {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({
        jobId: body.jobId || body.requestId,
        action,
        callerId: body.callerId || body.userId,
        reason,
        durationMs: body.durationMs,
      }),
    });
    return transitionPOST(proxyReq);
  } catch (error: any) {
    console.error("Error in /api/calls/end:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
