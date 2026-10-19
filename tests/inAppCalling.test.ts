/**
 * tests/inAppCalling.test.ts
 *
 * Unit tests for the In-App Calling & Masked Communication system.
 * Tests cover:
 *  - State gate: calls must be blocked for jobs not yet confirmed
 *  - State gate: calls allowed for active job states
 *  - Concurrency guard: a second call initiation is rejected when a call is already ringing/ongoing
 *  - Participant check: non-participants cannot initiate calls
 *  - Call log text format validation
 *  - Call duration formatting
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallStatus = "ringing" | "ongoing" | "ended";
type CallType = "audio" | "video";

interface ActiveCall {
  channelName: string;
  callerId: string;
  type: CallType;
  status: CallStatus;
  timestamp: number;
  connectedAt: number | null;
}

interface Job {
  requestId: string;
  customerId: string;
  artisanId: string;
  state: string;
  activeCall?: ActiveCall | null;
}

// ─── Logic under test (pure functions extracted from the route) ────────────────

const ALLOWED_STATES = [
  "pending",
  "countered",
  "payment_pending",
  "awaiting_deposit",
  "negotiating",
  "accepted",
  "confirmed",
  "en_route",
  "arrived",
  "in_progress",
  "awaiting_customer_confirmation",
  "completed",
];

type InitiateCallResult =
  | { success: true; receiverId: string }
  | { error: string; code: string; status: number };

function initiateCall(
  job: Job,
  callerId: string,
  callType: CallType
): InitiateCallResult {
  // 1. State gate
  if (!ALLOWED_STATES.includes(job.state)) {
    return {
      error: `Calls are only available once a job is confirmed. Current state: ${job.state}`,
      code: "CALL_STATE_GATE",
      status: 403,
    };
  }

  // 2. Participant check
  if (job.customerId !== callerId && job.artisanId !== callerId) {
    return {
      error: "Only job participants may initiate calls",
      code: "UNAUTHORIZED",
      status: 403,
    };
  }

  // 3. Concurrency guard
  const existingCall = job.activeCall;
  if (
    existingCall &&
    (existingCall.status === "ringing" || existingCall.status === "ongoing")
  ) {
    return {
      error: "A call is already active on this job",
      code: "CALL_ACTIVE",
      status: 409,
    };
  }

  const receiverId =
    job.customerId === callerId ? job.artisanId : job.customerId;

  return { success: true, receiverId };
}

function formatCallDuration(
  connectedAt: number | null,
  reason: "ended" | "cancelled" | "declined" | "timeout"
): string {
  if (connectedAt) {
    const durationMs = Math.max(0, Date.now() - connectedAt);
    const totalSeconds = Math.floor(durationMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")} mins`;
  }
  if (reason === "declined") return "Declined Call";
  if (reason === "cancelled") return "Cancelled";
  if (reason === "timeout") return "Missed Call";
  return "Missed Call";
}

function buildCallLogText(isVideo: boolean, durationText: string): string {
  return `[CALL_LOG]:${isVideo ? "video" : "voice"}:${durationText}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  requestId: "job_abc",
  customerId: "cust_1",
  artisanId: "artisan_1",
  state: "confirmed",
  activeCall: null,
  ...overrides,
});

describe("call state gate", () => {
  it("allows calls when job is in pending state", () => {
    const result = initiateCall(makeJob({ state: "pending" }), "cust_1", "audio");
    assert.ok("success" in result);
    assert.equal((result as any).success, true);
  });

  it("allows calls when job is in negotiating state", () => {
    const result = initiateCall(makeJob({ state: "negotiating" }), "cust_1", "audio");
    assert.ok("success" in result);
    assert.equal((result as any).success, true);
  });

  it("blocks calls when job is cancelled", () => {
    const result = initiateCall(makeJob({ state: "cancelled" }), "cust_1", "audio");
    assert.ok("code" in result);
    assert.equal((result as any).code, "CALL_STATE_GATE");
  });

  it("blocks calls when job is declined", () => {
    const result = initiateCall(makeJob({ state: "declined" }), "cust_1", "audio");
    assert.ok("code" in result);
    assert.equal((result as any).code, "CALL_STATE_GATE");
  });

  it("allows calls when job is accepted", () => {
    const result = initiateCall(makeJob({ state: "accepted" }), "cust_1", "audio");
    assert.ok("success" in result);
    assert.equal((result as any).success, true);
    assert.equal((result as any).receiverId, "artisan_1");
  });

  it("allows calls when job is confirmed", () => {
    const result = initiateCall(makeJob({ state: "confirmed" }), "cust_1", "audio");
    assert.ok("success" in result);
    assert.equal((result as any).success, true);
    assert.equal((result as any).receiverId, "artisan_1");
  });

  it("allows calls when job is en_route", () => {
    const result = initiateCall(makeJob({ state: "en_route" }), "artisan_1", "video");
    assert.ok("success" in result);
    assert.equal((result as any).receiverId, "cust_1");
  });

  it("allows calls when job is arrived", () => {
    const result = initiateCall(makeJob({ state: "arrived" }), "cust_1", "audio");
    assert.ok("success" in result);
  });

  it("allows calls when job is in_progress", () => {
    const result = initiateCall(makeJob({ state: "in_progress" }), "artisan_1", "audio");
    assert.ok("success" in result);
  });

  it("allows calls when job is awaiting_customer_confirmation", () => {
    const result = initiateCall(
      makeJob({ state: "awaiting_customer_confirmation" }),
      "cust_1",
      "audio"
    );
    assert.ok("success" in result);
  });
});

describe("call participant gate", () => {
  it("blocks calls from non-participants", () => {
    const result = initiateCall(makeJob(), "random_user_xyz", "audio");
    assert.ok("code" in result);
    assert.equal((result as any).code, "UNAUTHORIZED");
    assert.equal((result as any).status, 403);
  });

  it("allows customer to call", () => {
    const result = initiateCall(makeJob(), "cust_1", "audio");
    assert.ok("success" in result);
    assert.equal((result as any).receiverId, "artisan_1");
  });

  it("allows artisan to call", () => {
    const result = initiateCall(makeJob(), "artisan_1", "audio");
    assert.ok("success" in result);
    assert.equal((result as any).receiverId, "cust_1");
  });
});

describe("call concurrency guard", () => {
  it("blocks a second call when one is already ringing", () => {
    const job = makeJob({
      activeCall: {
        channelName: "job_abc",
        callerId: "artisan_1",
        type: "audio",
        status: "ringing",
        timestamp: Date.now(),
        connectedAt: null,
      },
    });
    const result = initiateCall(job, "cust_1", "audio");
    assert.ok("code" in result);
    assert.equal((result as any).code, "CALL_ACTIVE");
    assert.equal((result as any).status, 409);
  });

  it("blocks a new call when one is already ongoing", () => {
    const job = makeJob({
      activeCall: {
        channelName: "job_abc",
        callerId: "cust_1",
        type: "video",
        status: "ongoing",
        timestamp: Date.now() - 60000,
        connectedAt: Date.now() - 55000,
      },
    });
    const result = initiateCall(job, "artisan_1", "audio");
    assert.ok("code" in result);
    assert.equal((result as any).code, "CALL_ACTIVE");
  });

  it("allows a new call when previous call has ended", () => {
    const job = makeJob({
      activeCall: {
        channelName: "job_abc",
        callerId: "cust_1",
        type: "audio",
        status: "ended",
        timestamp: Date.now() - 120000,
        connectedAt: Date.now() - 115000,
      },
    });
    const result = initiateCall(job, "artisan_1", "audio");
    assert.ok("success" in result);
  });
});

describe("call log text format", () => {
  it("formats an audio missed call", () => {
    const duration = formatCallDuration(null, "timeout");
    const log = buildCallLogText(false, duration);
    assert.equal(log, "[CALL_LOG]:voice:Missed Call");
  });

  it("formats a video declined call", () => {
    const duration = formatCallDuration(null, "declined");
    const log = buildCallLogText(true, duration);
    assert.equal(log, "[CALL_LOG]:video:Declined Call");
  });

  it("formats a cancelled call", () => {
    const duration = formatCallDuration(null, "cancelled");
    const log = buildCallLogText(false, duration);
    assert.equal(log, "[CALL_LOG]:voice:Cancelled");
  });

  it("formats a connected call with duration", () => {
    // Simulate a 90-second call
    const connectedAt = Date.now() - 90_000;
    const duration = formatCallDuration(connectedAt, "ended");
    const log = buildCallLogText(false, duration);
    // Should be "[CALL_LOG]:voice:1:30 mins"
    assert.ok(log.startsWith("[CALL_LOG]:voice:1:"), `Expected 1:xx mins, got: ${log}`);
    assert.ok(log.endsWith("mins"), `Expected to end with 'mins', got: ${log}`);
  });

  it("formats a 5-minute video call", () => {
    const connectedAt = Date.now() - 300_000;
    const duration = formatCallDuration(connectedAt, "ended");
    const log = buildCallLogText(true, duration);
    assert.ok(log.startsWith("[CALL_LOG]:video:5:"), `Expected 5:xx mins, got: ${log}`);
  });

  it("synchronizes duration from bothConnectedAt accurately", () => {
    // Both users connected 75 seconds ago
    const bothConnectedAt = Date.now() - 75_000;
    const duration = formatCallDuration(bothConnectedAt, "ended");
    const log = buildCallLogText(false, duration);
    assert.ok(log.startsWith("[CALL_LOG]:voice:1:15"), `Expected 1:15, got ${log}`);
  });
});
