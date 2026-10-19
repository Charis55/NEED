/**
 * src/lib/callStateMachine.ts
 *
 * Server-authoritative pure call state machine.
 *
 * Implements the 5 core rules:
 *  1. The server is the single authority on call state.
 *  2. Every call attempt has a unique callId.
 *  3. Every transition is idempotent and monotonic (rev incrementing).
 *  4. Terminal states can NEVER be resurrected.
 *  5. Ring timeout is server-enforced with ringExpiresAt.
 */

export type CallStatus =
  | "ringing"
  | "accepted"
  | "ongoing"
  | "connected"
  | "ended"
  | "declined"
  | "missed"
  | "cancelled"
  | "failed"
  | "busy";

export type CallAction =
  | "accept"
  | "decline"
  | "cancel"
  | "timeout"
  | "joined"
  | "end"
  | "fail"
  | "peerLost";

export type CallActor = "caller" | "callee" | "system";

export interface CallParty {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  role: "customer" | "artisan";
  agoraUid: number;
}

export interface ActiveCall {
  callId: string;
  jobId: string;
  channelName: string;
  rev: number;
  status: CallStatus;
  type?: "audio" | "video";
  callType?: "audio" | "video";
  callerId: string;
  receiverId: string;
  callerName?: string;
  callerPhoto?: string | null;
  receiverName?: string;
  receiverPhoto?: string | null;
  caller?: CallParty;
  callee?: CallParty;
  callerSessionId?: string | null;
  acceptedBySession?: string | null;
  timestamp: number;
  createdAt: number;
  ringExpiresAt: number;
  acceptedAt?: number | null;
  connectedAt?: number | null;
  bothConnectedAt?: number | null;
  endedAt?: number | null;
  endedBy?: CallActor | null;
  endedReason?: string | null;
}

export const TERMINAL_CALL_STATUSES = new Set<CallStatus>([
  "ended",
  "declined",
  "missed",
  "cancelled",
  "failed",
  "busy",
]);

export function isTerminalCallStatus(status: CallStatus): boolean {
  return TERMINAL_CALL_STATUSES.has(status);
}

interface TransitionRule {
  from: CallStatus[];
  to: CallStatus;
  actors: CallActor[];
}

const ACTION_RULES: Record<CallAction, TransitionRule> = {
  // accept moves from ringing to ongoing/accepted
  accept: {
    from: ["ringing"],
    to: "ongoing",
    actors: ["callee"],
  },
  decline: {
    from: ["ringing"],
    to: "declined",
    actors: ["callee"],
  },
  cancel: {
    from: ["ringing"],
    to: "cancelled",
    actors: ["caller"],
  },
  timeout: {
    from: ["ringing"],
    to: "missed",
    actors: ["system", "caller"],
  },
  joined: {
    from: ["accepted", "ongoing", "connected"],
    to: "connected",
    actors: ["caller", "callee"],
  },
  end: {
    from: ["accepted", "ongoing", "connected", "ringing"],
    to: "ended",
    actors: ["caller", "callee", "system"],
  },
  fail: {
    from: ["ringing", "accepted", "ongoing", "connected"],
    to: "failed",
    actors: ["caller", "callee", "system"],
  },
  peerLost: {
    from: ["accepted", "ongoing", "connected"],
    to: "ended",
    actors: ["system"],
  },
};

export type TransitionResult =
  | { kind: "apply"; next: Partial<ActiveCall> & { status: CallStatus; rev: number } }
  | { kind: "noop"; reason: "already_in_target" | "already_terminal" | "stale" }
  | { kind: "reject"; reason: string };

export interface TransitionContext {
  now: number;
  sessionId?: string | null;
  reason?: string | null;
}

/**
 * Pure transition validator and applier.
 *
 * @param call The existing ActiveCall document state
 * @param action The requested action
 * @param actor Who is requesting: "caller" | "callee" | "system"
 * @param ctx Context containing server timestamp, session, and reason
 */
export function applyCallTransition(
  call: ActiveCall,
  action: CallAction,
  actor: CallActor,
  ctx: TransitionContext
): TransitionResult {
  const rule = ACTION_RULES[action];
  if (!rule) {
    return { kind: "reject", reason: "unknown_action" };
  }

  if (!rule.actors.includes(actor)) {
    return { kind: "reject", reason: "actor_not_allowed" };
  }

  // Idempotency: already in target status
  if (call.status === rule.to) {
    return { kind: "noop", reason: "already_in_target" };
  }

  // Monotonic: Terminal states can NEVER be resurrected
  if (TERMINAL_CALL_STATUSES.has(call.status)) {
    return { kind: "noop", reason: "already_terminal" };
  }

  // Check valid source states (handle ongoing and accepted interchangeably)
  const isFromAllowed =
    rule.from.includes(call.status) ||
    (rule.from.includes("ongoing") && call.status === "accepted") ||
    (rule.from.includes("accepted") && call.status === "ongoing");

  if (!isFromAllowed) {
    return { kind: "noop", reason: "stale" };
  }

  // Enforce server ring timeout (ringExpiresAt)
  if (action === "accept" && call.ringExpiresAt && ctx.now > call.ringExpiresAt) {
    return { kind: "reject", reason: "expired" };
  }

  const nextRev = (call.rev || 0) + 1;
  const updates: Partial<ActiveCall> & { status: CallStatus; rev: number } = {
    status: rule.to,
    rev: nextRev,
  };

  if (action === "accept") {
    updates.acceptedAt = ctx.now;
    updates.connectedAt = ctx.now;
    if (ctx.sessionId) {
      updates.acceptedBySession = ctx.sessionId;
    }
  } else if (action === "joined") {
    updates.bothConnectedAt = ctx.now;
  } else if (TERMINAL_CALL_STATUSES.has(rule.to)) {
    updates.endedAt = ctx.now;
    updates.endedBy = actor;
    updates.endedReason = ctx.reason || (rule.to as string);
  }

  return { kind: "apply", next: updates };
}
