import { GuaranteeClaim, JobRequestData, PlatformConfig, Kobo } from "@/types/platform";

export interface GuaranteeEligibilityResult {
  eligible: boolean;
  error?: string;
}

/**
 * Validates whether a job is eligible for opening a 30-day rework guarantee claim.
 * Must be completed, settled on NEED, within the guarantee window, and not already claimed.
 */
export function validateGuaranteeClaimEligibility(
  job: Partial<JobRequestData> | null | undefined,
  config: PlatformConfig,
  customerId: string,
  description: string,
  now: number = Date.now()
): GuaranteeEligibilityResult {
  if (!job) {
    return { eligible: false, error: "Job not found" };
  }

  if (job.customerId !== customerId) {
    return { eligible: false, error: "Unauthorized: Only the customer who booked the job can open a guarantee claim." };
  }

  if (job.state !== "completed") {
    return { eligible: false, error: "Claims are only eligible for completed jobs." };
  }

  if (!job.commissionSettled) {
    return { eligible: false, error: "Claims are only eligible for jobs settled on NEED." };
  }

  if (job.guaranteeClaimId) {
    return { eligible: false, error: "A guarantee claim has already been opened for this job." };
  }

  const windowDays = config.guarantee?.windowDays ?? 30;
  const completedAt = job.completedAt || job.stateUpdatedAt || now;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  if (now - completedAt > windowMs) {
    return { eligible: false, error: `The guarantee window (${windowDays} days) has expired for this job.` };
  }

  if (!description || description.trim().length < 10) {
    return { eligible: false, error: "Please provide a detailed description (at least 10 characters) of the issue." };
  }

  return { eligible: true };
}

export type GuaranteeResolutionAction = "redo_arranged" | "refunded_clawback" | "rejected";

export interface ResolveGuaranteeParams {
  claim: GuaranteeClaim;
  job: JobRequestData;
  adminId: string;
  resolution: GuaranteeResolutionAction;
  notes: string;
  clawbackAmountKobo?: number;
  artisanWalletBalance?: number;
  now?: number;
}

export interface ResolveGuaranteeResult {
  newClaimStatus: GuaranteeClaim["status"];
  newJobState: JobRequestData["state"];
  claimUpdates: Partial<GuaranteeClaim>;
  jobUpdates: Partial<JobRequestData>;
  eventPayload: Record<string, unknown>;
  walletUpdate?: {
    newBalance: Kobo;
    clawbackAmount: Kobo;
    txType: "guarantee_clawback";
    reference: string;
  };
  customerCredit?: {
    amount: Kobo;
    reason: "guarantee_refund";
    jobId: string;
  };
}

/**
 * Pure business logic for resolving a guarantee claim.
 * Supports:
 * 1. redo_arranged: orders original artisan to redo defective work at ₦0, returning job to in_progress
 * 2. refunded_clawback: customer refunded via platform credits, debited from artisan wallet balance
 * 3. rejected: claim denied by admin, restoring job state to completed
 */
export function resolveGuaranteeClaimPure(params: ResolveGuaranteeParams): ResolveGuaranteeResult {
  const {
    claim,
    job,
    adminId,
    resolution,
    notes,
    clawbackAmountKobo,
    artisanWalletBalance = 0,
    now = Date.now()
  } = params;

  if (!adminId) {
    throw new Error("Admin ID is required to resolve a guarantee claim.");
  }

  if (!notes || notes.trim().length < 5) {
    throw new Error("Admin resolution note is required (at least 5 characters).");
  }

  if (["redo_arranged", "refunded_clawback", "rejected"].includes(claim.status)) {
    throw new Error(`Claim is already resolved with status '${claim.status}'.`);
  }

  if (resolution === "redo_arranged") {
    return {
      newClaimStatus: "redo_arranged",
      newJobState: "in_progress",
      claimUpdates: {
        status: "redo_arranged",
        resolutionNotes: notes,
        resolvedAt: now,
        resolvedBy: adminId
      },
      jobUpdates: {
        state: "in_progress",
        stateUpdatedAt: now,
        guaranteeResolution: "redo_arranged"
      },
      eventPayload: {
        action: "redo_arranged",
        resolvedBy: adminId,
        notes
      }
    };
  }

  if (resolution === "rejected") {
    return {
      newClaimStatus: "rejected",
      newJobState: "completed",
      claimUpdates: {
        status: "rejected",
        resolutionNotes: notes,
        resolvedAt: now,
        resolvedBy: adminId
      },
      jobUpdates: {
        state: "completed",
        stateUpdatedAt: now,
        guaranteeResolution: "rejected"
      },
      eventPayload: {
        action: "rejected",
        resolvedBy: adminId,
        notes
      }
    };
  }

  if (resolution === "refunded_clawback") {
    const defaultAmount = job.depositPaid || job.agreedPrice || 0;
    const finalClawbackAmount = Math.max(
      1,
      Math.min(clawbackAmountKobo ?? defaultAmount, job.agreedPrice || defaultAmount || 100000)
    );

    const newBalance = artisanWalletBalance - finalClawbackAmount;

    return {
      newClaimStatus: "refunded_clawback",
      newJobState: "completed",
      claimUpdates: {
        status: "refunded_clawback",
        resolutionNotes: notes,
        resolvedAt: now,
        resolvedBy: adminId,
        refundAmount: finalClawbackAmount
      },
      jobUpdates: {
        state: "completed",
        stateUpdatedAt: now,
        guaranteeResolution: "refunded_clawback"
      },
      eventPayload: {
        action: "refunded_clawback",
        refundAmount: finalClawbackAmount,
        resolvedBy: adminId,
        notes
      },
      walletUpdate: {
        newBalance,
        clawbackAmount: finalClawbackAmount,
        txType: "guarantee_clawback",
        reference: `clawback_${claim.claimId}`
      },
      customerCredit: {
        amount: finalClawbackAmount,
        reason: "guarantee_refund",
        jobId: job.requestId
      }
    };
  }

  throw new Error(`Unsupported resolution action: ${resolution}`);
}
