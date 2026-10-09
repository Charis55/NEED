import { JobState } from "@/types/platform";

export type ActorRole = "customer" | "artisan" | "system" | "admin";

export type TransitionGuard = 
  | "priceAgreed" 
  | "depositPaidOrNotRequired" 
  | "depositWindowExpired" 
  | "geofenceHit" 
  | "manualArrival" 
  | "autoConfirmElapsed" 
  | "withinGuaranteeWindow" 
  | "reviewResolved";

export interface TransitionRule {
  to: JobState;
  actor: ActorRole;
  guard?: TransitionGuard;
}

export const jobStateTransitions: Record<JobState, TransitionRule[]> = {
  requested: [
    { to: "negotiating", actor: "artisan" }, 
    { to: "awaiting_deposit", actor: "artisan", guard: "priceAgreed" }, 
    { to: "cancelled", actor: "customer" }, 
    { to: "cancelled", actor: "artisan" }
  ],
  negotiating: [
    { to: "awaiting_deposit", actor: "customer", guard: "priceAgreed" }, 
    { to: "cancelled", actor: "customer" }, 
    { to: "cancelled", actor: "artisan" }
  ],
  awaiting_deposit: [
    { to: "confirmed", actor: "system", guard: "depositPaidOrNotRequired" }, 
    { to: "cancelled", actor: "system", guard: "depositWindowExpired" }, 
    { to: "cancelled", actor: "customer" }
  ],
  confirmed: [
    { to: "en_route", actor: "artisan" }, 
    { to: "cancelled", actor: "customer" }, 
    { to: "cancelled", actor: "artisan" }
  ],
  en_route: [
    { to: "arrived", actor: "system", guard: "geofenceHit" }, 
    { to: "arrived", actor: "artisan", guard: "manualArrival" }, 
    { to: "cancelled", actor: "customer" }, 
    { to: "cancelled", actor: "artisan" }
  ],
  arrived: [
    { to: "in_progress", actor: "artisan" }, 
    { to: "cancelled_after_arrival_review", actor: "customer" }, 
    { to: "cancelled_after_arrival_review", actor: "artisan" }
  ],
  in_progress: [
    { to: "awaiting_customer_confirmation", actor: "artisan" }, 
    { to: "cancelled_after_arrival_review", actor: "customer" }, 
    { to: "cancelled_after_arrival_review", actor: "artisan" }
  ],
  awaiting_customer_confirmation: [
    { to: "completed", actor: "customer" }, 
    { to: "completed", actor: "system", guard: "autoConfirmElapsed" }, 
    { to: "disputed", actor: "customer" }
  ],
  completed: [
    { to: "disputed", actor: "customer", guard: "withinGuaranteeWindow" }
  ],
  cancelled_after_arrival_review: [
    { to: "cancelled", actor: "system", guard: "reviewResolved" }, 
    { to: "disputed", actor: "admin" }
  ],
  disputed: [
    { to: "completed", actor: "admin" }, 
    { to: "cancelled", actor: "admin" }
  ],
  cancelled: []
};

/**
 * Validates whether a state transition is legal according to the transition table.
 * Does NOT evaluate guards (guards must be evaluated by the caller).
 */
export function isValidTransition(fromState: JobState, toState: JobState, actor: ActorRole, guard?: TransitionGuard): boolean {
  const possibleTransitions = jobStateTransitions[fromState];
  if (!possibleTransitions) return false;

  return possibleTransitions.some(
    t => t.to === toState && t.actor === actor && t.guard === guard
  );
}
