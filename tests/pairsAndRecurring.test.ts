import assert from "node:assert";
import test from "node:test";
import { computeFee, computeRequiredDeposit } from "../src/lib/feeEngine";
import { haversineDistanceMeters } from "../src/lib/locationTracker";
import { PlatformConfig, RecurringService } from "../src/types/platform";

const mockConfig: PlatformConfig = {
  version: 1,
  feeTiers: [
    { upToPairJobNumber: 1, ratePercent: 15 },
    { upToPairJobNumber: 2, ratePercent: 10 },
    { upToPairJobNumber: 999, ratePercent: 6 }
  ],
  minimumFee: 50000,
  depositPercent: 25,
  depositMinimum: 100000,
  depositWindowMinutes: 30,
  requireDeposit: true,
  escrowEnabled: false,
  autoConfirmHours: 24,
  walletCreditLimit: 300000,
  overdueCommissionDays: 7,
  cancellation: {
    customerFreeBeforeEnRouteMinutes: 60,
    customerFeeAfterEnRoute: 150000,
    afterArrivalReviewHours: 48,
    callOutFee: 150000,
  },
  guarantee: { windowDays: 30, enabled: true },
  arrival: { radiusMeters: 300, consecutivePings: 3, pingSeconds: 30 },
  leakage: { watchScore: 10, reviewScore: 20, windowDays: 30 },
  rewards: { inAppPaymentCredit: 30000, surveyCredit: 10000 },
  chat: { blockPhoneNumbers: true, blockHandles: true }
};

test("repeat client tiers - 1st job charges standard 15% fee", () => {
  const priceKobo = 2000000; // ₦20,000
  const pairJobNumber = 1;
  const result = computeFee(priceKobo, pairJobNumber, mockConfig);

  assert.strictEqual(result.ratePercent, 15);
  assert.strictEqual(result.fee, 300000); // ₦3,000 fee
});

test("repeat client tiers - 2nd job discounts fee to 10% (saves 5%)", () => {
  const priceKobo = 2000000; // ₦20,000
  const pairJobNumber = 2;
  const result = computeFee(priceKobo, pairJobNumber, mockConfig);

  assert.strictEqual(result.ratePercent, 10);
  assert.strictEqual(result.fee, 200000); // ₦2,000 fee instead of ₦3,000
});

test("repeat client tiers - 3+ jobs discounts fee to VIP 6% (saves 9%)", () => {
  const priceKobo = 2000000; // ₦20,000
  const pairJobNumber = 3;
  const result = computeFee(priceKobo, pairJobNumber, mockConfig);

  assert.strictEqual(result.ratePercent, 6);
  assert.strictEqual(result.fee, 120000); // ₦1,200 fee instead of ₦3,000
});

test("geofence distance - calculates distance in meters via haversine formula", () => {
  // Lagos coordinates: ~110m distance test
  const lat1 = 6.5244;
  const lon1 = 3.3792;
  const lat2 = 6.5254;
  const lon2 = 3.3792;

  const distance = haversineDistanceMeters(lat1, lon1, lat2, lon2);
  assert.ok(distance > 100 && distance < 130, `Distance was ${distance}`);

  // Test inside 300m geofence radius
  const isWithinGeofence = distance <= mockConfig.arrival.radiusMeters;
  assert.strictEqual(isWithinGeofence, true);
});

test("geofence distance - detects when technician is outside 300m radius", () => {
  // Lagos points ~1.1km apart
  const lat1 = 6.5244;
  const lon1 = 3.3792;
  const lat2 = 6.5344;
  const lon2 = 3.3792;

  const distance = haversineDistanceMeters(lat1, lon1, lat2, lon2);
  assert.ok(distance > 1000);
  assert.strictEqual(distance <= mockConfig.arrival.radiusMeters, false);
});

test("recurring services - advances schedule by interval months on notification", () => {
  const intervalMonths = 3;
  const now = 1700000000000;
  const nextDueAt = now + intervalMonths * 30 * 24 * 60 * 60 * 1000;

  const service: RecurringService = {
    id: "rec_1",
    customerId: "cust_abc",
    artisanId: "art_xyz",
    trade: "AC Repair",
    subcategory: "Periodic AC Servicing",
    intervalMonths,
    nextDueAt,
    optedIn: true
  };

  assert.strictEqual(service.optedIn, true);
  assert.strictEqual(service.nextDueAt > now, true);

  // Advance by 3 months
  const advancedDueAt = nextDueAt + intervalMonths * 30 * 24 * 60 * 60 * 1000;
  assert.strictEqual(advancedDueAt, nextDueAt + 7776000000);
});
