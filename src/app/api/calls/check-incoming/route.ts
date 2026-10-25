import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getActiveCallForUser } from "@/lib/callRegistry";

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
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400, headers: corsHeaders });
    }

    const now = Date.now();

    // 0. Instant in-memory check (sub-millisecond, zero Firestore quota cost)
    const inMemoryCall = getActiveCallForUser(uid);
    if (inMemoryCall && inMemoryCall.status === "ringing") {
      return NextResponse.json({
        hasCall: true,
        jobId: inMemoryCall.jobId,
        callId: inMemoryCall.callId,
        channelName: inMemoryCall.channelName,
        isVideo: inMemoryCall.callType === "video",
        callerName: inMemoryCall.callerName || "Customer",
        callerPhoto: inMemoryCall.callerPhoto || null,
        callerId: inMemoryCall.callerId,
      }, { headers: corsHeaders });
    }

    // 1. Check indexed callInbox for lightning-fast lookup
    try {
      const inboxSnap = await adminDb
        .collection("users")
        .doc(uid)
        .collection("callInbox")
        .where("status", "==", "ringing")
        .limit(1)
        .get();

      if (!inboxSnap.empty) {
        const inboxData = inboxSnap.docs[0].data();
        if (inboxData.ringExpiresAt && inboxData.ringExpiresAt > now && inboxData.callerId !== uid) {
          return NextResponse.json({
            hasCall: true,
            jobId: inboxData.jobId,
            callId: inboxData.callId,
            channelName: inboxData.channelName,
            isVideo: inboxData.callType === "video",
            callerName: inboxData.callerName || "Customer",
            callerPhoto: inboxData.callerPhoto || null,
            callerId: inboxData.callerId,
          }, { headers: corsHeaders });
        }
      }
    } catch (e) {
      // Index might be updating, fallback to jobRequests below
    }

    // 2. Direct fallback to jobRequests collection for this user as artisan or customer
    const [artisanSnap, customerSnap] = await Promise.all([
      adminDb
        .collection("jobRequests")
        .where("artisanId", "==", uid)
        .where("activeCall.status", "==", "ringing")
        .limit(1)
        .get(),
      adminDb
        .collection("jobRequests")
        .where("customerId", "==", uid)
        .where("activeCall.status", "==", "ringing")
        .limit(1)
        .get(),
    ]);

    const activeDoc = !artisanSnap.empty ? artisanSnap.docs[0] : (!customerSnap.empty ? customerSnap.docs[0] : null);

    if (activeDoc) {
      const jobData = activeDoc.data();
      const call = jobData.activeCall;
      if (call && call.status === "ringing" && call.callerId !== uid) {
        const age = now - (call.timestamp || call.createdAt || 0);
        const expiresAt = call.ringExpiresAt || (call.timestamp ? call.timestamp + 45000 : 0);
        if (age <= 45000 && (expiresAt ? now < expiresAt : true) && age >= -10000) {
          const isVideo = call.type === "video" || call.callType === "video";
          return NextResponse.json({
            hasCall: true,
            jobId: activeDoc.id,
            callId: call.callId,
            channelName: call.channelName,
            isVideo,
            callerName: call.callerName || "Customer",
            callerPhoto: call.callerPhoto || null,
            callerId: call.callerId,
          }, { headers: corsHeaders });
        }
      }
    }

    return NextResponse.json({ hasCall: false }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[check-incoming] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500, headers: corsHeaders });
  }
}
