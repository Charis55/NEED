import assert from "node:assert";
import test from "node:test";
import { computeFee, computeRequiredDeposit } from "../src/lib/feeEngine";
import { PlatformConfig } from "../src/types/platform";

const mockConfig: PlatformConfig = {
  version: 1,
  feeTiers: [
    { upToPairJobNumber: 1, ratePercent: 15 },
    { upToPairJobNumber: 2, ratePercent: 10 },
    { upToPairJobNumber: 999, ratePercent: 6 }
  ],
  minimumFee: 50000,                       // N500 (in kobo)
  depositPercent: 25,                      // 25%
  depositMinimum: 100000,                  // N1,000 (in kobo)
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

test("computeFee - tier 1 (first job with artisan)", () => {
  // 15% of 10,000 NGN (1,000,000 kobo) = 150,000 kobo (N1,500)
  const res = computeFee(1000000, 1, mockConfig);
  assert.strictEqual(res.ratePercent, 15);
  assert.strictEqual(res.fee, 150000);
});

test("computeFee - tier 2 (repeat job 2)", () => {
  // 10% of 10,000 NGN (1,000,000 kobo) = 100,000 kobo (N1,000)
  const res = computeFee(1000000, 2, mockConfig);
  assert.strictEqual(res.ratePercent, 10);
  assert.strictEqual(res.fee, 100000);
});

test("computeFee - tier 3 (frequent customer 3+ jobs)", () => {
  // 6% of 10,000 NGN (1,000,000 kobo) = 60,000 kobo (N600)
  const res = computeFee(1000000, 3, mockConfig);
  assert.strictEqual(res.ratePercent, 6);
  assert.strictEqual(res.fee, 60000);
});

test("computeFee - enforces minimum fee when percentage is smaller", () => {
  // 15% of 1,000 NGN (100,000 kobo) = 15,000 kobo. Minimum fee is 50,000 kobo (N500).
  const res = computeFee(100000, 1, mockConfig);
  assert.strictEqual(res.fee, 50000);
});

test("computeFee - caps fee at finalPrice for tiny job prices", () => {
  // Job price is 30,000 kobo (N300). Minimum fee is 50,000 kobo.
  // Fee must be capped at 30,000 kobo.
  const res = computeFee(30000, 1, mockConfig);
  assert.strictEqual(res.fee, 30000);
});

test("computeRequiredDeposit - deposit must be at least the platform fee and depositMinimum", () => {
  // agreedPrice = 1,000,000 kobo (N10,000), 25% = 250,000 kobo, fee = 150,000 kobo.
  // Max(250,000, 100,000, 150,000) = 250,000 kobo.
  const dep = computeRequiredDeposit(1000000, 150000, mockConfig);
  assert.strictEqual(dep, 250000);
});

test("computeRequiredDeposit - returns 0 if requireDeposit is false", () => {
  const cfgWithoutDeposit = { ...mockConfig, requireDeposit: false };
  const dep = computeRequiredDeposit(1000000, 150000, cfgWithoutDeposit);
  assert.strictEqual(dep, 0);
});
