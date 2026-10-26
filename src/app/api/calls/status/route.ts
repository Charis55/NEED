import { NextRequest, NextResponse } from "next/server";
import { getActiveCall } from "@/lib/callRegistry";
import { adminDb } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId") || searchParams.get("requestId");
    const callId = searchParams.get("callId");

    if (!jobId && !callId) {
      return NextResponse.json(
        { error: "jobId or callId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fast in-memory lookup (sub-millisecond, zero Firestore quota cost)
    const inMemoryCall = getActiveCall((callId || jobId)!);
    if (inMemoryCall) {
      return NextResponse.json({
        success: true,
        status: inMemoryCall.status,
        endedReason: inMemoryCall.endedReason || null,
        activeCall: inMemoryCall,
      }, { headers: corsHeaders });
    }

    // 2. Fallback to Firestore if not found in memory (e.g. across server instance restart)
    if (jobId) {
      try {
        const jobDoc = await adminDb.collection("jobRequests").doc(jobId).get();
        if (jobDoc.exists) {
          const data = jobDoc.data()!;
          const call = data.activeCall;
          if (call) {
            const now = Date.now();
            let effectiveStatus = call.status || "none";
            let effectiveEndedReason = call.endedReason || null;
            if (effectiveStatus === "ringing") {
              const age = now - (call.timestamp || call.createdAt || 0);
              const expiresAt = call.ringExpiresAt || (call.timestamp ? call.timestamp + 45000 : 0);
              if ((expiresAt && now >= expiresAt) || age > 45000) {
                effectiveStatus = "ended";
                effectiveEndedReason = "timeout";
              }
            } else if (effectiveStatus === "ongoing" || effectiveStatus === "connected" || effectiveStatus === "accepted") {
              // Ongoing calls persist until hung up. Only terminate if abandoned for > 4 hours.
              const syncTime = call.bothConnectedAt || call.connectedAt || call.timestamp || 0;
              if (syncTime && now - syncTime > 4 * 60 * 60 * 1000) {
                effectiveStatus = "ended";
                effectiveEndedReason = "timeout";
              }
            }
            return NextResponse.json({
              success: true,
              status: effectiveStatus,
              endedReason: effectiveEndedReason,
              activeCall: {
                ...call,
                status: effectiveStatus,
                endedReason: effectiveEndedReason,
              },
            }, { headers: corsHeaders });
          }
        }
      } catch (dbErr: any) {
        console.warn("[calls/status] Firestore read warning:", dbErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      status: "none",
    }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
