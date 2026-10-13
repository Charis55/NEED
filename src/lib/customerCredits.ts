import { adminDb } from "@/lib/firebaseAdmin";
import { CustomerCredit, Kobo, PlatformConfig } from "@/types/platform";
import { getConfig } from "@/lib/platformConfig";

export interface CustomerCreditSummary {
  availableBalanceKobo: Kobo;
  lifetimeEarnedKobo: Kobo;
  availableCredits: CustomerCredit[];
  usedCredits: CustomerCredit[];
}

/**
 * Awards in-app payment loyalty credit to the customer when a deposit or full payment is made.
 * Uses deterministic ID `credit_pay_${jobId}` to guarantee strict idempotency.
 */
export async function awardInAppPaymentCredit(
  tx: FirebaseFirestore.Transaction,
  customerId: string,
  jobId: string,
  config?: PlatformConfig
): Promise<boolean> {
  const cfg = config || (await getConfig());
  const bonusAmount = cfg.rewards?.inAppPaymentCredit ?? 30000;
  if (bonusAmount <= 0) return false;

  const creditId = `credit_pay_${jobId}`;
  const creditRef = adminDb.collection("customerCredits").doc(creditId);
  const snap = await tx.get(creditRef);
  if (snap.exists) {
    return false; // Already awarded for this job
  }

  tx.set(creditRef, {
    creditId,
    customerId,
    amount: bonusAmount,
    reason: "in_app_payment_bonus",
    jobId,
    used: false,
    createdAt: Date.now()
  });

  return true;
}

/**
 * Awards survey completion credit to the customer.
 * Uses deterministic ID `credit_survey_${surveyId}` to guarantee strict idempotency.
 */
export async function awardSurveyCredit(
  tx: FirebaseFirestore.Transaction,
  customerId: string,
  surveyId: string,
  config?: PlatformConfig
): Promise<boolean> {
  const cfg = config || (await getConfig());
  const surveyBonus = cfg.rewards?.surveyCredit ?? 10000;
  if (surveyBonus <= 0) return false;

  const creditId = `credit_survey_${surveyId}`;
  const creditRef = adminDb.collection("customerCredits").doc(creditId);
  const snap = await tx.get(creditRef);
  if (snap.exists) {
    return false; // Already awarded for this survey
  }

  tx.set(creditRef, {
    creditId,
    customerId,
    amount: surveyBonus,
    reason: "survey_completion",
    surveyId,
    used: false,
    createdAt: Date.now()
  });

  return true;
}

/**
 * Fetches all credits for a customer and calculates available and lifetime amounts.
 */
export async function getCustomerCreditSummary(customerId: string): Promise<CustomerCreditSummary> {
  const snap = await adminDb
    .collection("customerCredits")
    .where("customerId", "==", customerId)
    .get();

  let availableBalanceKobo: Kobo = 0;
  let lifetimeEarnedKobo: Kobo = 0;
  const availableCredits: CustomerCredit[] = [];
  const usedCredits: CustomerCredit[] = [];

  snap.forEach((doc) => {
    const data = doc.data() as CustomerCredit;
    const amount = Number(data.amount || 0);
    lifetimeEarnedKobo += amount;
    if (!data.used) {
      availableBalanceKobo += amount;
      availableCredits.push(data);
    } else {
      usedCredits.push(data);
    }
  });

  availableCredits.sort((a, b) => b.createdAt - a.createdAt);
  usedCredits.sort((a, b) => (b.usedAt || b.createdAt) - (a.usedAt || a.createdAt));

  return {
    availableBalanceKobo,
    lifetimeEarnedKobo,
    availableCredits,
    usedCredits
  };
}

/**
 * Applies available customer credits towards a job deposit or invoice.
 * Must be executed within a transaction where the read phase occurs BEFORE any writes.
 * Supports splitting a credit if the credit value exceeds the required discount.
 */
export async function applyCustomerCredits(
  tx: FirebaseFirestore.Transaction,
  customerId: string,
  jobId: string,
  maxDiscountKobo: Kobo
): Promise<{
  discountAppliedKobo: Kobo;
  usedCreditIds: string[];
}> {
  if (maxDiscountKobo <= 0) {
    return { discountAppliedKobo: 0, usedCreditIds: [] };
  }

  const query = adminDb
    .collection("customerCredits")
    .where("customerId", "==", customerId)
    .where("used", "==", false);

  const snapshot = await tx.get(query);
  if (snapshot.empty) {
    return { discountAppliedKobo: 0, usedCreditIds: [] };
  }

  // Sort FIFO (oldest credits consumed first)
  const docs = snapshot.docs.map((d) => ({
    ref: d.ref,
    data: d.data() as CustomerCredit
  }));
  docs.sort((a, b) => a.data.createdAt - b.data.createdAt);

  let remainingNeeded = maxDiscountKobo;
  let discountApplied = 0;
  const usedCreditIds: string[] = [];

  for (const { ref, data } of docs) {
    if (remainingNeeded <= 0) break;

    const creditAmount = Number(data.amount || 0);
    if (creditAmount <= 0) continue;

    if (creditAmount <= remainingNeeded) {
      // Consume whole credit
      tx.update(ref, {
        used: true,
        usedJobId: jobId,
        usedAt: Date.now()
      });
      usedCreditIds.push(data.creditId);
      discountApplied += creditAmount;
      remainingNeeded -= creditAmount;
    } else {
      // Partial consumption: update current credit to used portion, create new credit for remainder
      const usedPortion = remainingNeeded;
      const leftoverPortion = creditAmount - remainingNeeded;

      tx.update(ref, {
        amount: usedPortion,
        used: true,
        usedJobId: jobId,
        usedAt: Date.now()
      });
      usedCreditIds.push(data.creditId);

      const leftoverRef = adminDb.collection("customerCredits").doc();
      tx.set(leftoverRef, {
        creditId: leftoverRef.id,
        customerId,
        amount: leftoverPortion,
        reason: data.reason,
        jobId: data.jobId || null,
        surveyId: data.surveyId || null,
        used: false,
        createdAt: data.createdAt
      });

      discountApplied += usedPortion;
      remainingNeeded = 0;
      break;
    }
  }

  return {
    discountAppliedKobo: discountApplied,
    usedCreditIds
  };
}

/**
 * Refunds previously used customer credits if a job is cancelled before dispatch/en_route.
 */
export async function refundCustomerCredits(
  tx: FirebaseFirestore.Transaction,
  jobId: string
): Promise<number> {
  const query = adminDb
    .collection("customerCredits")
    .where("usedJobId", "==", jobId)
    .where("used", "==", true);

  const snapshot = await tx.get(query);
  if (snapshot.empty) return 0;

  let totalRefundedKobo = 0;
  snapshot.forEach((doc) => {
    const data = doc.data() as CustomerCredit;
    totalRefundedKobo += Number(data.amount || 0);
    tx.update(doc.ref, {
      used: false,
      usedJobId: null,
      usedAt: null
    });
  });

  return totalRefundedKobo;
}
