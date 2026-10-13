import assert from "node:assert";
import test from "node:test";
import { isValidTransition, jobStateTransitions } from "../src/lib/jobStateMachine";

test("jobStateMachine - legal transitions", () => {
  assert.strictEqual(isValidTransition("requested", "negotiating", "artisan"), true);
  assert.strictEqual(isValidTransition("requested", "awaiting_deposit", "artisan", "priceAgreed"), true);
  assert.strictEqual(isValidTransition("awaiting_deposit", "confirmed", "system", "depositPaidOrNotRequired"), true);
  assert.strictEqual(isValidTransition("confirmed", "en_route", "artisan"), true);
  assert.strictEqual(isValidTransition("en_route", "arrived", "system", "geofenceHit"), true);
  assert.strictEqual(isValidTransition("en_route", "arrived", "artisan", "manualArrival"), true);
  assert.strictEqual(isValidTransition("arrived", "in_progress", "artisan"), true);
  assert.strictEqual(isValidTransition("in_progress", "awaiting_customer_confirmation", "artisan"), true);
  assert.strictEqual(isValidTransition("awaiting_customer_confirmation", "completed", "customer"), true);
  assert.strictEqual(isValidTransition("awaiting_customer_confirmation", "completed", "system", "autoConfirmElapsed"), true);
  assert.strictEqual(isValidTransition("completed", "disputed", "customer", "withinGuaranteeWindow"), true);
});

test("jobStateMachine - illegal transitions throw or return false", () => {
  // Customer cannot mark arrived
  assert.strictEqual(isValidTransition("en_route", "arrived", "customer"), false);
  // Artisan cannot complete job directly from en_route
  assert.strictEqual(isValidTransition("en_route", "completed", "artisan"), false);
  // Cannot jump from requested to completed
  assert.strictEqual(isValidTransition("requested", "completed", "customer"), false);
  // Cancelled jobs cannot transition to confirmed
  assert.strictEqual(isValidTransition("cancelled", "confirmed", "artisan"), false);
});
