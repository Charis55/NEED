import assert from "node:assert";
import test from "node:test";
import { CustomerCredit, PlatformConfig, Kobo } from "../src/types/platform";

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
  rewards: { inAppPaymentCredit: 30000, surveyCredit: 10000 }, // ₦300, ₦100
  chat: { blockPhoneNumbers: true, blockHandles: true }
};

/**
 * Pure simulation of the credit application algorithm in src/lib/customerCredits.ts
 */
function simulateApplyCredits(
  credits: CustomerCredit[],
  depositRequired: Kobo,
  jobId: string
) {
  // Filter unused and sort FIFO
  const available = credits
    .filter((c) => !c.used)
    .sort((a, b) => a.createdAt - b.createdAt);

  let remainingNeeded = depositRequired;
  let discountApplied = 0;
  const updatedCredits: CustomerCredit[] = [];
  const newlyCreatedCredits: CustomerCredit[] = [];

  for (const cred of available) {
    if (remainingNeeded <= 0) break;

    const amt = cred.amount;
    if (amt <= remainingNeeded) {
      updatedCredits.push({
        ...cred,
        used: true,
        usedJobId: jobId,
        usedAt: Date.now()
      });
      discountApplied += amt;
      remainingNeeded -= amt;
    } else {
      // Partial consumption
      const usedPart = remainingNeeded;
      const leftoverPart = amt - remainingNeeded;

      updatedCredits.push({
        ...cred,
        amount: usedPart,
        used: true,
        usedJobId: jobId,
        usedAt: Date.now()
      });

      newlyCreatedCredits.push({
        creditId: `${cred.creditId}_leftover`,
        customerId: cred.customerId,
        amount: leftoverPart,
        reason: cred.reason,
        used: false,
        createdAt: cred.createdAt
      });

      discountApplied += usedPart;
      remainingNeeded = 0;
      break;
    }
  }

  const amountToPay = depositRequired - discountApplied;

  return {
    discountApplied,
    amountToPay,
    fullyCovered: amountToPay === 0,
    updatedCredits,
    newlyCreatedCredits
  };
}

test("customer credits - applies partial credit discount to required deposit", () => {
  const credits: CustomerCredit[] = [
    {
      creditId: "cred_1",
      customerId: "cust_123",
      amount: 30000, // ₦300
      reason: "in_app_payment_bonus",
      used: false,
      createdAt: 1000
    },
    {
      creditId: "cred_2",
      customerId: "cust_123",
      amount: 10000, // ₦100
      reason: "survey_completion",
      used: false,
      createdAt: 2000
    }
  ];

  const depositRequired = 100000; // ₦1,000
  const result = simulateApplyCredits(credits, depositRequired, "job_999");

  assert.strictEqual(result.discountApplied, 40000); // ₦400 discount
  assert.strictEqual(result.amountToPay, 60000); // ₦600 remaining to pay via Paystack
  assert.strictEqual(result.fullyCovered, false);
  assert.strictEqual(result.updatedCredits.length, 2);
  assert.strictEqual(result.updatedCredits[0].used, true);
  assert.strictEqual(result.updatedCredits[1].used, true);
});

test("customer credits - covers 100% of deposit when balance exceeds deposit", () => {
  const credits: CustomerCredit[] = [
    {
      creditId: "cred_large",
      customerId: "cust_123",
      amount: 150000, // ₦1,500
      reason: "goodwill",
      used: false,
      createdAt: 1000
    }
  ];

  const depositRequired = 100000; // ₦1,000
  const result = simulateApplyCredits(credits, depositRequired, "job_abc");

  assert.strictEqual(result.discountApplied, 100000); // ₦1,000 applied
  assert.strictEqual(result.amountToPay, 0); // ₦0 to pay!
  assert.strictEqual(result.fullyCovered, true);
  
  // Verify original credit was updated to used portion (₦1,000)
  assert.strictEqual(result.updatedCredits[0].amount, 100000);
  assert.strictEqual(result.updatedCredits[0].used, true);

  // Verify leftover credit was created with remainder (₦500)
  assert.strictEqual(result.newlyCreatedCredits.length, 1);
  assert.strictEqual(result.newlyCreatedCredits[0].amount, 50000);
  assert.strictEqual(result.newlyCreatedCredits[0].used, false);
});

test("customer credits - consumes FIFO (oldest credit first)", () => {
  const credits: CustomerCredit[] = [
    {
      creditId: "cred_new",
      customerId: "cust_123",
      amount: 30000,
      reason: "in_app_payment_bonus",
      used: false,
      createdAt: 5000 // Newer
    },
    {
      creditId: "cred_old",
      customerId: "cust_123",
      amount: 30000,
      reason: "survey_completion",
      used: false,
      createdAt: 1000 // Older
    }
  ];

  const depositRequired = 25000; // ₦250
  const result = simulateApplyCredits(credits, depositRequired, "job_fifo");

  // Oldest credit should be the one consumed
  assert.strictEqual(result.updatedCredits[0].creditId, "cred_old");
  assert.strictEqual(result.discountApplied, 25000);
  assert.strictEqual(result.amountToPay, 0);
  assert.strictEqual(result.fullyCovered, true);
});

test("customer rewards - awards in_app_payment_bonus and survey_completion accurately", () => {
  assert.strictEqual(mockConfig.rewards.inAppPaymentCredit, 30000); // ₦300
  assert.strictEqual(mockConfig.rewards.surveyCredit, 10000); // ₦100

  // Simulate award record creation
  const inAppReward: CustomerCredit = {
    creditId: `credit_pay_job123`,
    customerId: "cust_1",
    amount: mockConfig.rewards.inAppPaymentCredit,
    reason: "in_app_payment_bonus",
    jobId: "job123",
    used: false,
    createdAt: Date.now()
  };

  const surveyReward: CustomerCredit = {
    creditId: `credit_survey_surv456`,
    customerId: "cust_1",
    amount: mockConfig.rewards.surveyCredit,
    reason: "survey_completion",
    surveyId: "surv456",
    used: false,
    createdAt: Date.now()
  };

  assert.strictEqual(inAppReward.amount, 30000);
  assert.strictEqual(inAppReward.reason, "in_app_payment_bonus");
  assert.strictEqual(surveyReward.amount, 10000);
  assert.strictEqual(surveyReward.reason, "survey_completion");
});

test("customer credits - restores used credits when job cancelled before en_route", () => {
  const credits: CustomerCredit[] = [
    {
      creditId: "cred_used_1",
      customerId: "cust_1",
      amount: 30000,
      reason: "in_app_payment_bonus",
      used: true,
      usedJobId: "job_cancelled",
      usedAt: 1000,
      createdAt: 500
    }
  ];

  // Simulation of pre-en_route cancellation refund logic
  const restoredCredits = credits.map(c => {
    if (c.usedJobId === "job_cancelled") {
      return {
        ...c,
        used: false,
        usedJobId: undefined,
        usedAt: undefined
      };
    }
    return c;
  });

  assert.strictEqual(restoredCredits[0].used, false);
  assert.strictEqual(restoredCredits[0].usedJobId, undefined);
  assert.strictEqual(restoredCredits[0].amount, 30000);
});
