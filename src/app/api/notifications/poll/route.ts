import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// In-memory poll cache to prevent runaway polling from exhausting Firestore free/paid quotas
interface PollCacheEntry {
  timestamp: number;
  call: any;
  notifications: any[];
}

const pollCache = new Map<string, PollCacheEntry>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const sinceParam = searchParams.get("since");

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400, headers: corsHeaders });
    }

    const now = Date.now();

    // 1. Quota & Rate Guard: If this exact UID polled less than 3500ms ago, return cached state with zero DB reads
    const cached = pollCache.get(uid);
    if (cached && (now - cached.timestamp < 3500)) {
      return NextResponse.json({
        call: cached.call,
        notifications: [],
        serverTime: now,
      }, { headers: corsHeaders });
    }

    const since = sinceParam ? Math.max(Number(sinceParam) || 0, now - 120000) : (now - 30000);

    // 2. Check for Active Incoming Calls (CallKit)
    let callData: any = { hasCall: false };

    try {
      // Primary check: user's personal callInbox (written atomically on /api/calls/initiate)
      const inboxSnap = await adminDb
        .collection("users")
        .doc(uid)
        .collection("callInbox")
        .where("status", "==", "ringing")
        .limit(1)
        .get();

      if (!inboxSnap.empty) {
        const inbox = inboxSnap.docs[0].data();
        if (inbox.ringExpiresAt && inbox.ringExpiresAt > now && inbox.callerId !== uid) {
          callData = {
            hasCall: true,
            jobId: inbox.jobId,
            callId: inbox.callId,
            channelName: inbox.channelName,
            isVideo: inbox.callType === "video",
            callerName: inbox.callerName || "Customer",
            callerPhoto: inbox.callerPhoto || null,
            callerId: inbox.callerId,
          };
        }
      }
    } catch (e) {
      // Ignore index sync errors
    }

    // Secondary fallback only if callInbox was empty
    if (!callData.hasCall) {
      try {
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
          const job = activeDoc.data();
          const call = job.activeCall;
          if (call && call.status === "ringing" && call.callerId !== uid) {
            const age = now - (call.timestamp || call.createdAt || 0);
            if (age <= 45000) {
              callData = {
                hasCall: true,
                jobId: activeDoc.id,
                callId: call.callId,
                channelName: call.channelName,
                isVideo: call.type === "video" || call.callType === "video",
                callerName: call.callerName || "Customer",
                callerPhoto: call.callerPhoto || null,
                callerId: call.callerId,
              };
            }
          }
        }
      } catch (e) {
        // Ignore fallback errors
      }
    }

    // 3. Check for New Unread Notifications
    const notifications: any[] = [];
    const seenIds = new Set<string>();

    try {
      const notifsSnap = await adminDb
        .collection("users")
        .doc(uid)
        .collection("notifications")
        .where("createdAt", ">", since)
        .orderBy("createdAt", "asc")
        .limit(10)
        .get();

      notifsSnap.docs.forEach((d) => {
        const data = d.data();
        if (!seenIds.has(data.id || d.id)) {
          seenIds.add(data.id || d.id);
          notifications.push({
            id: data.id || d.id,
            title: data.title || "Need Notification",
            body: data.body || "",
            data: data.data || {},
            createdAt: data.createdAt || now,
          });
        }
      });
    } catch (e) {
      // In case of indexing error, fallback gracefully
      try {
        const fallbackSnap = await adminDb
          .collection("users")
          .doc(uid)
          .collection("notifications")
          .orderBy("createdAt", "desc")
          .limit(5)
          .get();

        fallbackSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.createdAt && data.createdAt > since && !seenIds.has(data.id || d.id)) {
            seenIds.add(data.id || d.id);
            notifications.push({
              id: data.id || d.id,
              title: data.title || "Need Notification",
              body: data.body || "",
              data: data.data || {},
              createdAt: data.createdAt,
            });
          }
        });
      } catch (fallbackErr) {}
    }

    // Cache this result in memory to throttle subsequent poll requests from this device
    pollCache.set(uid, {
      timestamp: now,
      call: callData,
      notifications,
    });

    // Prune stale cache entries if map grows large
    if (pollCache.size > 500) {
      for (const [k, v] of pollCache.entries()) {
        if (now - v.timestamp > 60000) {
          pollCache.delete(k);
        }
      }
    }

    return NextResponse.json({
      call: callData,
      notifications,
      serverTime: now,
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[notifications/poll] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error", call: { hasCall: false }, notifications: [], serverTime: Date.now() },
      { status: 500, headers: corsHeaders }
    );
  }
}
