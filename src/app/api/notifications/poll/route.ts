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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const sinceParam = searchParams.get("since");

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400, headers: corsHeaders });
    }

    const now = Date.now();
    // Default to last 30 seconds if 'since' not provided or too old
    const since = sinceParam ? Math.max(Number(sinceParam) || 0, now - 120000) : (now - 30000);

    // 1. Check for Active Incoming Calls (CallKit)
    let callData: any = { hasCall: false };

    try {
      // A. Check indexed callInbox
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

    if (!callData.hasCall) {
      // B. Fallback to jobRequests for ringing calls
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

    // C. Check if user is in an ongoing / connected call so native background sync doesn't falsely end it
    if (!callData.hasCall) {
      try {
        const [artisanOngoingSnap, customerOngoingSnap] = await Promise.all([
          adminDb
            .collection("jobRequests")
            .where("artisanId", "==", uid)
            .where("activeCall.status", "in", ["ongoing", "connected", "accepted"])
            .limit(1)
            .get(),
          adminDb
            .collection("jobRequests")
            .where("customerId", "==", uid)
            .where("activeCall.status", "in", ["ongoing", "connected", "accepted"])
            .limit(1)
            .get(),
        ]);

        const ongoingDoc = !artisanOngoingSnap.empty
          ? artisanOngoingSnap.docs[0]
          : (!customerOngoingSnap.empty ? customerOngoingSnap.docs[0] : null);

        if (ongoingDoc) {
          const job = ongoingDoc.data();
          const call = job.activeCall;
          callData = {
            hasCall: false,
            isOngoing: true,
            jobId: ongoingDoc.id,
            callId: call?.callId,
          };
        }
      } catch (e) {
        // Ignore fallback errors
      }
    }

    // 2. Check for New Unread Notifications
    const notifications: any[] = [];
    const seenIds = new Set<string>();

    try {
      // A. Fetch from users/{uid}/notifications
      const notifsSnap = await adminDb
        .collection("users")
        .doc(uid)
        .collection("notifications")
        .where("createdAt", ">", since)
        .orderBy("createdAt", "asc")
        .limit(15)
        .get();

      notifsSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (!seenIds.has(d.id || doc.id)) {
          seenIds.add(d.id || doc.id);
          notifications.push({
            id: d.id || doc.id,
            title: d.title || "Need Notification",
            body: d.body || "",
            data: d.data || {},
            createdAt: d.createdAt || now,
          });
        }
      });
    } catch (e) {
      // If composite index is pending, fallback to reading recent documents
      try {
        const recentSnap = await adminDb
          .collection("users")
          .doc(uid)
          .collection("notifications")
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();

        recentSnap.docs.forEach((doc) => {
          const d = doc.data();
          if (d.createdAt && d.createdAt > since && !seenIds.has(d.id || doc.id)) {
            seenIds.add(d.id || doc.id);
            notifications.push({
              id: d.id || doc.id,
              title: d.title || "Need Notification",
              body: d.body || "",
              data: d.data || {},
              createdAt: d.createdAt,
            });
          }
        });
      } catch (fallbackErr) {
        // Ignore
      }
    }

    // B. Direct check on jobRequests for recent chat messages or pending job requests
    try {
      const [artisanJobs, customerJobs] = await Promise.all([
        adminDb.collection("jobRequests").where("artisanId", "==", uid).limit(10).get(),
        adminDb.collection("jobRequests").where("customerId", "==", uid).limit(10).get(),
      ]);

      const allJobs = [...artisanJobs.docs, ...customerJobs.docs];
      for (const jDoc of allJobs) {
        const jData = jDoc.data();
        // Check new chat message
        if (
          jData.lastMessageAt &&
          jData.lastMessageAt > since &&
          jData.lastMessageSenderId &&
          jData.lastMessageSenderId !== uid
        ) {
          const msgId = `msg_${jDoc.id}_${jData.lastMessageAt}`;
          if (!seenIds.has(msgId)) {
            seenIds.add(msgId);
            let preview = jData.lastMessageText || "New message";
            if (preview.startsWith("[CALL_LOG]:")) continue; // Call logs handled by CallKit
            if (preview.length > 50) preview = preview.substring(0, 50) + "...";
            notifications.push({
              id: msgId,
              title: "New Message",
              body: preview,
              data: { type: "chat", requestId: jDoc.id },
              createdAt: jData.lastMessageAt,
            });
          }
        }

        // Check new job request for artisan
        if (
          jData.artisanId === uid &&
          jData.status === "pending" &&
          jData.createdAt &&
          jData.createdAt > since
        ) {
          const jobId = `job_${jDoc.id}`;
          if (!seenIds.has(jobId)) {
            seenIds.add(jobId);
            notifications.push({
              id: jobId,
              title: "New Job Request",
              body: jData.trade ? `New request for ${jData.trade}` : "You have a new job request",
              data: { type: "job", requestId: jDoc.id },
              createdAt: jData.createdAt,
            });
          }
        }
      }
    } catch (e) {
      // Ignore job scan errors
    }

    // Sort notifications chronologically
    notifications.sort((a, b) => a.createdAt - b.createdAt);

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
