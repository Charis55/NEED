/**
 * In-Memory Active Call Registry
 *
 * Provides sub-millisecond, zero-quota synchronized state across all call API endpoints
 * (/api/calls/initiate, /api/calls/accept, /api/calls/decline, /api/calls/end, /api/calls/status,
 * /api/notifications/poll, /api/calls/check-incoming).
 *
 * This ensures audio/video calls connect and dismiss seamlessly even under heavy load,
 * network delays, or Firebase Spark daily quota limits.
 */

export interface ActiveCallRecord {
  callId: string;
  jobId: string;
  channelName: string;
  status: "ringing" | "ongoing" | "ended";
  callType: "audio" | "video";
  type?: "audio" | "video";
  callerId: string;
  callerName: string;
  callerPhoto?: string | null;
  receiverId: string;
  receiverName: string;
  receiverPhoto?: string | null;
  connectedAt?: number | null;
  bothConnectedAt?: number | null;
  endedAt?: number | null;
  endedReason?: "declined" | "cancelled" | "timeout" | "ended" | null;
  callerSessionId?: string | null;
  callerDeviceId?: string | null;
  callerPlatform?: string | null;
  acceptedBySession?: string | null;
  acceptedByDeviceId?: string | null;
  acceptedByPlatform?: string | null;
  ringExpiresAt?: number | null;
  timestamp: number;
}

// Global in-memory storage (preserved across API route invocations in Node runtime)
const g = global as unknown as {
  __needActiveCallsByJob?: Map<string, ActiveCallRecord>;
  __needActiveCallsById?: Map<string, ActiveCallRecord>;
};

if (!g.__needActiveCallsByJob) {
  g.__needActiveCallsByJob = new Map();
}
if (!g.__needActiveCallsById) {
  g.__needActiveCallsById = new Map();
}

const callsByJob = g.__needActiveCallsByJob;
const callsById = g.__needActiveCallsById;

// Clean up stale calls older than 30 minutes
function purgeStaleCalls() {
  const now = Date.now();
  const TTL = 30 * 60 * 1000;
  for (const [key, call] of callsByJob.entries()) {
    if (now - call.timestamp > TTL) {
      callsByJob.delete(key);
      callsById.delete(call.callId);
    }
  }
}

export function registerActiveCall(record: ActiveCallRecord): ActiveCallRecord {
  purgeStaleCalls();
  callsByJob.set(record.jobId, record);
  if (record.callId) {
    callsById.set(record.callId, record);
  }
  return record;
}

export function getActiveCall(jobIdOrCallId: string): ActiveCallRecord | undefined {
  if (!jobIdOrCallId) return undefined;
  const call = callsByJob.get(jobIdOrCallId) || callsById.get(jobIdOrCallId);
  if (!call) return undefined;

  const now = Date.now();
  if (call.status === "ringing") {
    const expiresAt = call.ringExpiresAt || (call.timestamp ? call.timestamp + 45000 : 0);
    const age = now - (call.timestamp || 0);
    if ((expiresAt && now >= expiresAt) || age > 45000) {
      call.status = "ended";
      call.endedReason = "timeout";
      call.endedAt = now;
    }
  } else if (call.status === "ongoing") {
    // Ongoing calls persist until explicitly hung up. Guard only against orphaned abandoned calls (> 4 hours).
    const syncTime = call.bothConnectedAt || call.connectedAt || call.timestamp || 0;
    if (syncTime && now - syncTime > 4 * 60 * 60 * 1000) {
      call.status = "ended";
      call.endedReason = "timeout";
      call.endedAt = now;
    }
  }
  return call;
}

export function updateActiveCallStatus(
  jobIdOrCallId: string,
  status: "ongoing" | "ended",
  extra?: Partial<ActiveCallRecord>
): ActiveCallRecord | undefined {
  const existing = getActiveCall(jobIdOrCallId);
  if (!existing) {
    // If updating a call that wasn't in memory (e.g. server restart), create minimal stub
    const stub: ActiveCallRecord = {
      callId: extra?.callId || jobIdOrCallId,
      jobId: extra?.jobId || jobIdOrCallId,
      channelName: extra?.channelName || jobIdOrCallId,
      status,
      callType: extra?.callType || "audio",
      callerId: extra?.callerId || "",
      callerName: extra?.callerName || "Caller",
      receiverId: extra?.receiverId || "",
      receiverName: extra?.receiverName || "User",
      timestamp: Date.now(),
      ...extra,
    };
    callsByJob.set(stub.jobId, stub);
    if (stub.callId) callsById.set(stub.callId, stub);
    return stub;
  }

  const updated: ActiveCallRecord = {
    ...existing,
    ...extra,
    status,
  };

  callsByJob.set(updated.jobId, updated);
  if (updated.callId) {
    callsById.set(updated.callId, updated);
  }
  return updated;
}

export function getActiveCallForUser(uid: string): ActiveCallRecord | undefined {
  if (!uid) return undefined;
  const now = Date.now();
  for (const call of callsByJob.values()) {
    if (call.receiverId === uid) {
      if (call.status === "ringing") {
        const expiresAt = call.ringExpiresAt || (call.timestamp ? call.timestamp + 45000 : 0);
        const age = now - (call.timestamp || 0);
        if (now < expiresAt && age <= 45000 && age >= -10000) {
          return call;
        } else {
          call.status = "ended";
          call.endedReason = "timeout";
          call.endedAt = now;
        }
      }
    }
  }
  return undefined;
}

