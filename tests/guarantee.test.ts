import assert from "node:assert";
import test from "node:test";
import {
  validateGuaranteeClaimEligibility,
  resolveGuaranteeClaimPure,
  ResolveGuaranteeParams
} from "../src/lib/guarantee";
import { defaultPlatformConfig } from "../src/lib/platformConfig";
import { GuaranteeClaim, JobRequestData } from "../src/types/platform";

test("Guarantee - Eligibility Validation", () => {
  const config = defaultPlatformConfig;
  const now = 1700000000000;
  const customerId = "cust_123";
  const validDesc = "The plumbing repair started leaking again heavily from the main joint.";

  const baseJob: JobRequestData = {
    requestId: "job_001",
    customerId,
    artisanId: "art_456",
    trade: "plumbing",
    subcategory: "pipe_repair",
    description: "Fix leaking pipe",
    neighborhood: "Yaba",
    approxLat: 6.5,
    approxLng: 3.3,
    scheduledFor: now - 86400000 * 5,
    state: "completed",
    stateUpdatedAt: now - 86400000 * 5,
    completedAt: now - 86400000 * 5,
    agreedPrice: 2000000,
    finalPrice: 2000000,
    paymentMode: "deposit_plus_cash",
    depositRequired: 400000,
    depositPaid: 400000,
    depositStatus: "released",
    platformFee: 300000,
    feeConfigVersion: 1,
    feeRatePercentApplied: 15,
    pairJobNumber: 1,
    commissionSettled: true,
    bookedViaPlatform: true,
    arrivedAt: now - 86400000 * 6,
    arrivalSource: "manual",
    locationUnavailable: false,
    customerConfirmedAt: now - 86400000 * 5,
    autoConfirmAt: null,
    cancelledBy: null,
    cancelReasonCode: null,
    createdAt: now - 86400000 * 7
  };

  // 1. Valid job passes
  const validRes = validateGuaranteeClaimEligibility(baseJob, config, customerId, validDesc, now);
  assert.strictEqual(validRes.eligible, true);

  // 2. Missing job fails
  const nullJobRes = validateGuaranteeClaimEligibility(null, config, customerId, validDesc, now);
  assert.strictEqual(nullJobRes.eligible, false);

  // 3. Customer ID mismatch fails
  const wrongCust = validateGuaranteeClaimEligibility(baseJob, config, "cust_intruder", validDesc, now);
  assert.strictEqual(wrongCust.eligible, false);
  assert.match(wrongCust.error || "", /Unauthorized/);

  // 4. Job not completed fails
  const pendingJob = { ...baseJob, state: "in_progress" as const };
  const inProgressRes = validateGuaranteeClaimEligibility(pendingJob, config, customerId, validDesc, now);
  assert.strictEqual(inProgressRes.eligible, false);
  assert.match(inProgressRes.error || "", /completed jobs/);

  // 5. Unsettled commission fails
  const unsettledJob = { ...baseJob, commissionSettled: false };
  const unsettledRes = validateGuaranteeClaimEligibility(unsettledJob, config, customerId, validDesc, now);
  assert.strictEqual(unsettledRes.eligible, false);
  assert.match(unsettledRes.error || "", /settled on NEED/);

  // 6. Already opened claim fails
  const alreadyClaimed = { ...baseJob, guaranteeClaimId: "claim_existing" };
  const duplicateRes = validateGuaranteeClaimEligibility(alreadyClaimed, config, customerId, validDesc, now);
  assert.strictEqual(duplicateRes.eligible, false);
  assert.match(duplicateRes.error || "", /already been opened/);

  // 7. Window expired (> 30 days) fails
  const oldJob = { ...baseJob, completedAt: now - 86400000 * 35 };
  const expiredRes = validateGuaranteeClaimEligibility(oldJob, config, customerId, validDesc, now);
  assert.strictEqual(expiredRes.eligible, false);
  assert.match(expiredRes.error || "", /expired/);

  // 8. Description too short fails
  const shortDescRes = validateGuaranteeClaimEligibility(baseJob, config, customerId, "leak", now);
  assert.strictEqual(shortDescRes.eligible, false);
  assert.match(shortDescRes.error || "", /at least 10 characters/);
});

test("Guarantee - Resolution: Redo Arranged", () => {
  const claim: GuaranteeClaim = {
    claimId: "claim_101",
    jobId: "job_001",
    customerId: "cust_123",
    artisanId: "art_456",
    description: "Defective wiring on AC installation, trips breaker",
    photos: ["https://example.com/photo1.jpg"],
    status: "submitted",
    createdAt: Date.now() - 3600000
  };

  const job: JobRequestData = {
    requestId: "job_001",
    customerId: "cust_123",
    artisanId: "art_456",
    trade: "electrical",
    subcategory: "wiring",
    description: "Install AC breaker and wiring",
    neighborhood: "Ikeja",
    approxLat: 6.6,
    approxLng: 3.35,
    scheduledFor: Date.now() - 86400000 * 3,
    state: "disputed",
    stateUpdatedAt: Date.now() - 3600000,
    agreedPrice: 3000000,
    finalPrice: 3000000,
    paymentMode: "deposit_plus_cash",
    depositRequired: 600000,
    depositPaid: 600000,
    depositStatus: "released",
    platformFee: 450000,
    feeConfigVersion: 1,
    feeRatePercentApplied: 15,
    pairJobNumber: 1,
    commissionSettled: true,
    bookedViaPlatform: true,
    arrivedAt: Date.now() - 86400000 * 4,
    arrivalSource: "geofence",
    locationUnavailable: false,
    completedAt: Date.now() - 86400000 * 3,
    customerConfirmedAt: Date.now() - 86400000 * 3,
    autoConfirmAt: null,
    cancelledBy: null,
    cancelReasonCode: null,
    createdAt: Date.now() - 86400000 * 5
  };

  const res = resolveGuaranteeClaimPure({
    claim,
    job,
    adminId: "admin_grace",
    resolution: "redo_arranged",
    notes: "Spoke with artisan; agreed to visit tomorrow 10am to rewire at zero charge."
  });

  assert.strictEqual(res.newClaimStatus, "redo_arranged");
  assert.strictEqual(res.newJobState, "in_progress");
  assert.strictEqual(res.jobUpdates.guaranteeResolution, "redo_arranged");
  assert.strictEqual(res.claimUpdates.resolvedBy, "admin_grace");
  assert.strictEqual(res.walletUpdate, undefined);
  assert.strictEqual(res.customerCredit, undefined);
  assert.strictEqual(res.eventPayload.action, "redo_arranged");
});

test("Guarantee - Resolution: Refund & Clawback", () => {
  const claim: GuaranteeClaim = {
    claimId: "claim_102",
    jobId: "job_002",
    customerId: "cust_999",
    artisanId: "art_888",
    description: "Generator repair completely ruined carburetor; artisan refused to return",
    photos: [],
    status: "submitted",
    createdAt: Date.now() - 7200000
  };

  const job: JobRequestData = {
    requestId: "job_002",
    customerId: "cust_999",
    artisanId: "art_888",
    trade: "generator",
    subcategory: "servicing",
    description: "Service generator carburetor",
    neighborhood: "Surulere",
    approxLat: 6.5,
    approxLng: 3.35,
    scheduledFor: Date.now() - 86400000 * 2,
    state: "disputed",
    stateUpdatedAt: Date.now() - 7200000,
    agreedPrice: 2500000, // 25,000 NGN
    finalPrice: 2500000,
    paymentMode: "deposit_plus_cash",
    depositRequired: 500000, // 5,000 NGN
    depositPaid: 500000,
    depositStatus: "released",
    platformFee: 375000,
    feeConfigVersion: 1,
    feeRatePercentApplied: 15,
    pairJobNumber: 1,
    commissionSettled: true,
    bookedViaPlatform: true,
    arrivedAt: Date.now() - 86400000 * 3,
    arrivalSource: "manual",
    locationUnavailable: false,
    completedAt: Date.now() - 86400000 * 2,
    customerConfirmedAt: Date.now() - 86400000 * 2,
    autoConfirmAt: null,
    cancelledBy: null,
    cancelReasonCode: null,
    createdAt: Date.now() - 86400000 * 4
  };

  const artisanWalletBalance = 1500000; // 15,000 NGN

  // 1. Full deposit refund and clawback
  const res = resolveGuaranteeClaimPure({
    claim,
    job,
    adminId: "admin_mark",
    resolution: "refunded_clawback",
    notes: "Artisan breached terms; full deposit refunded to customer as loyalty credits and debited from wallet.",
    artisanWalletBalance
  });

  assert.strictEqual(res.newClaimStatus, "refunded_clawback");
  assert.strictEqual(res.newJobState, "completed");
  assert.strictEqual(res.jobUpdates.guaranteeResolution, "refunded_clawback");
  assert.strictEqual(res.claimUpdates.refundAmount, 500000);

  // Assert wallet debit
  assert.ok(res.walletUpdate);
  assert.strictEqual(res.walletUpdate?.clawbackAmount, 500000);
  assert.strictEqual(res.walletUpdate?.newBalance, 1000000);
  assert.strictEqual(res.walletUpdate?.txType, "guarantee_clawback");
  assert.strictEqual(res.walletUpdate?.reference, "clawback_claim_102");

  // Assert customer credit award
  assert.ok(res.customerCredit);
  assert.strictEqual(res.customerCredit?.amount, 500000);
  assert.strictEqual(res.customerCredit?.reason, "guarantee_refund");
  assert.strictEqual(res.customerCredit?.jobId, "job_002");
});

test("Guarantee - Resolution: Rejection and Invariant Guards", () => {
  const claim: GuaranteeClaim = {
    claimId: "claim_103",
    jobId: "job_003",
    customerId: "cust_777",
    artisanId: "art_666",
    description: "Customer wants full refund because of normal wear and tear after 25 days",
    photos: [],
    status: "submitted",
    createdAt: Date.now() - 86400000
  };

  const job: JobRequestData = {
    requestId: "job_003",
    customerId: "cust_777",
    artisanId: "art_666",
    trade: "carpentry",
    subcategory: "furniture_repair",
    description: "Fix wooden table leg",
    neighborhood: "Lekki",
    approxLat: 6.45,
    approxLng: 3.5,
    scheduledFor: Date.now() - 86400000 * 20,
    state: "disputed",
    stateUpdatedAt: Date.now() - 86400000,
    agreedPrice: 1500000,
    finalPrice: 1500000,
    paymentMode: "deposit_plus_cash",
    depositRequired: 300000,
    depositPaid: 300000,
    depositStatus: "released",
    platformFee: 225000,
    feeConfigVersion: 1,
    feeRatePercentApplied: 15,
    pairJobNumber: 1,
    commissionSettled: true,
    bookedViaPlatform: true,
    arrivedAt: Date.now() - 86400000 * 21,
    arrivalSource: "geofence",
    locationUnavailable: false,
    completedAt: Date.now() - 86400000 * 20,
    customerConfirmedAt: Date.now() - 86400000 * 20,
    autoConfirmAt: null,
    cancelledBy: null,
    cancelReasonCode: null,
    createdAt: Date.now() - 86400000 * 22
  };

  // Rejection
  const rejRes = resolveGuaranteeClaimPure({
    claim,
    job,
    adminId: "admin_femi",
    resolution: "rejected",
    notes: "Damage was caused by customer misuse after job completion; outside guarantee scope."
  });

  assert.strictEqual(rejRes.newClaimStatus, "rejected");
  assert.strictEqual(rejRes.newJobState, "completed");
  assert.strictEqual(rejRes.jobUpdates.guaranteeResolution, "rejected");
  assert.strictEqual(rejRes.walletUpdate, undefined);
  assert.strictEqual(rejRes.customerCredit, undefined);

  // Invariant 1: Missing notes throws
  assert.throws(
    () =>
      resolveGuaranteeClaimPure({
        claim,
        job,
        adminId: "admin_femi",
        resolution: "rejected",
        notes: ""
      }),
    /Admin resolution note is required/
  );

  // Invariant 2: Missing adminId throws
  assert.throws(
    () =>
      resolveGuaranteeClaimPure({
        claim,
        job,
        adminId: "",
        resolution: "rejected",
        notes: "Some note here"
      }),
    /Admin ID is required/
  );

  // Invariant 3: Already resolved claim throws
  const alreadyResolvedClaim: GuaranteeClaim = {
    ...claim,
    status: "refunded_clawback"
  };
  assert.throws(
    () =>
      resolveGuaranteeClaimPure({
        claim: alreadyResolvedClaim,
        job,
        adminId: "admin_femi",
        resolution: "redo_arranged",
        notes: "Trying to resolve again"
      }),
    /Claim is already resolved/
  );
});
