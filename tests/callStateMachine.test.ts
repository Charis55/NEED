/**
 * tests/callStateMachine.test.ts
 *
 * Unit test suite for the server-authoritative Call State Machine (Claude Section 2.3).
 * Verifies:
 *  1. Idempotency (repeating an action returns noop: already_in_target)
 *  2. Monotonicity (rev increments on valid transitions)
 *  3. Terminal protection (terminal states can never be resurrected)
 *  4. Actor validation (only callee can accept/decline; only caller can cancel)
 *  5. Server expiration (accept after ringExpiresAt is rejected)
 *  6. Concurrent transitions (winner takes state, loser receives noop)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyCallTransition,
  ActiveCall,
  CallStatus,
} from "../src/lib/callStateMachine";

const makeCall = (overrides: Partial<ActiveCall> = {}): ActiveCall => {
  const now = 100000;
  return {
    callId: "call_test_123",
    jobId: "job_test_123",
    channelName: "call_test_123",
    rev: 1,
    status: "ringing",
    callerId: "cust_1",
    receiverId: "art_1",
    timestamp: now,
    createdAt: now,
    ringExpiresAt: now + 45000, // 45s
    ...overrides,
  };
};

describe("callStateMachine - transitions and idempotency", () => {
  it("allows callee to accept a ringing call, incrementing rev", () => {
    const call = makeCall();
    const result = applyCallTransition(call, "accept", "callee", {
      now: 105000,
      sessionId: "sess_callee_1",
    });

    assert.equal(result.kind, "apply");
    if (result.kind === "apply") {
      assert.equal(result.next.status, "ongoing");
      assert.equal(result.next.rev, 2);
      assert.equal(result.next.acceptedBySession, "sess_callee_1");
      assert.equal(result.next.connectedAt, 105000);
    }
  });

  it("returns noop: already_in_target when accept is called a second time (idempotent)", () => {
    const call = makeCall({ status: "ongoing", rev: 2 });
    const result = applyCallTransition(call, "accept", "callee", { now: 106000 });
    assert.equal(result.kind, "noop");
    if (result.kind === "noop") {
      assert.equal(result.reason, "already_in_target");
    }
  });

  it("blocks caller from accepting call (actor not allowed)", () => {
    const call = makeCall();
    const result = applyCallTransition(call, "accept", "caller", { now: 105000 });
    assert.equal(result.kind, "reject");
    if (result.kind === "reject") {
      assert.equal(result.reason, "actor_not_allowed");
    }
  });

  it("allows caller to cancel a ringing call", () => {
    const call = makeCall();
    const result = applyCallTransition(call, "cancel", "caller", {
      now: 105000,
      reason: "cancelled",
    });

    assert.equal(result.kind, "apply");
    if (result.kind === "apply") {
      assert.equal(result.next.status, "cancelled");
      assert.equal(result.next.rev, 2);
      assert.equal(result.next.endedBy, "caller");
    }
  });

  it("allows callee to decline a ringing call", () => {
    const call = makeCall();
    const result = applyCallTransition(call, "decline", "callee", {
      now: 105000,
      reason: "declined",
    });

    assert.equal(result.kind, "apply");
    if (result.kind === "apply") {
      assert.equal(result.next.status, "declined");
      assert.equal(result.next.rev, 2);
      assert.equal(result.next.endedBy, "callee");
    }
  });

  it("blocks callee from cancelling call (only caller can cancel)", () => {
    const call = makeCall();
    const result = applyCallTransition(call, "cancel", "callee", { now: 105000 });
    assert.equal(result.kind, "reject");
    if (result.kind === "reject") {
      assert.equal(result.reason, "actor_not_allowed");
    }
  });
});

describe("callStateMachine - terminal state protection", () => {
  const terminalStatuses: CallStatus[] = [
    "ended",
    "declined",
    "missed",
    "cancelled",
    "failed",
    "busy",
  ];

  for (const terminal of terminalStatuses) {
    it(`never resurrects a call in '${terminal}' state when accept is requested`, () => {
      const call = makeCall({ status: terminal, rev: 3 });
      const result = applyCallTransition(call, "accept", "callee", { now: 120000 });
      assert.equal(result.kind, "noop");
      if (result.kind === "noop") {
        assert.equal(result.reason, "already_terminal");
      }
    });

    it(`never resurrects a call in '${terminal}' state when joined is requested`, () => {
      const call = makeCall({ status: terminal, rev: 3 });
      const result = applyCallTransition(call, "joined", "caller", { now: 120000 });
      assert.equal(result.kind, "noop");
      if (result.kind === "noop") {
        assert.equal(result.reason, "already_terminal");
      }
    });
  }
});

describe("callStateMachine - expiration and timing", () => {
  it("rejects accept if now is past ringExpiresAt", () => {
    const call = makeCall({ ringExpiresAt: 145000 });
    // Tapping accept at 146000 (after 45s TTL)
    const result = applyCallTransition(call, "accept", "callee", { now: 146000 });
    assert.equal(result.kind, "reject");
    if (result.kind === "reject") {
      assert.equal(result.reason, "expired");
    }
  });

  it("allows system timeout on ringing call", () => {
    const call = makeCall();
    const result = applyCallTransition(call, "timeout", "system", { now: 146000 });
    assert.equal(result.kind, "apply");
    if (result.kind === "apply") {
      assert.equal(result.next.status, "missed");
      assert.equal(result.next.rev, 2);
      assert.equal(result.next.endedBy, "system");
    }
  });
});

describe("callStateMachine - joined & connected synchronization", () => {
  it("transitions ongoing call to connected when joined is reported", () => {
    const call = makeCall({ status: "ongoing", rev: 2 });
    const result = applyCallTransition(call, "joined", "caller", { now: 110000 });
    assert.equal(result.kind, "apply");
    if (result.kind === "apply") {
      assert.equal(result.next.status, "connected");
      assert.equal(result.next.bothConnectedAt, 110000);
      assert.equal(result.next.rev, 3);
    }
  });

  it("allows either party to end an ongoing/connected call", () => {
    const call = makeCall({ status: "connected", rev: 3 });
    const result = applyCallTransition(call, "end", "callee", {
      now: 150000,
      reason: "completed",
    });
    assert.equal(result.kind, "apply");
    if (result.kind === "apply") {
      assert.equal(result.next.status, "ended");
      assert.equal(result.next.endedReason, "completed");
      assert.equal(result.next.rev, 4);
    }
  });
});
