import { adminDb } from "./firebaseAdmin";
import { getConfig } from "./platformConfig";
import { postLedgerEntry } from "./ledger";
import { writeJobEvent } from "./jobEvents";
import { JobRequestData, LeakageSurvey } from "@/types/platform";
import { computeFee } from "./feeEngine";
import { awardSurveyCredit, refundCustomerCredits } from "./customerCredits";

/**
 * Handles job cancellations across all states per Section 9 of the roadmap.
 */
export async function processJobCancellation(params: {
  jobId: string;
  cancelledBy: "customer" | "artisan";
  actorId: string;
  reasonCode: string;
  notes?: string;
}): Promise<{ newState: string; refundAmount: number; feeDeducted: number; artisanCompensation: number }> {
  const { jobId, cancelledBy, actorId, reasonCode, notes } = params;
  const config = await getConfig();

  return await adminDb.runTransaction(async (tx) => {
    const jobRef = adminDb.collection("jobRequests").doc(jobId);
    const jobSnap = await tx.get(jobRef);

    if (!jobSnap.exists) {
      throw new Error(`Job ${jobId} not found`);
    }

    const job = jobSnap.data() as JobRequestData;
    const currentState = job.state;
    const depositPaid = job.depositPaid || 0;

    // Read any credits used on this job before executing writes
    const usedCreditsQuery = adminDb
      .collection("customerCredits")
      .where("usedJobId", "==", jobId)
      .where("used", "==", true);
    const usedCreditsSnap = await tx.get(usedCreditsQuery);

    let newState: "cancelled" | "cancelled_after_arrival_review" = "cancelled";
    let refundAmount = 0;
    let artisanCompensation = 0;
    let feeDeducted = 0;

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 3: Cancelled AFTER arrival
    // ──────────────────────────────────────────────────────────────────────────
    if (currentState === "arrived" || currentState === "in_progress") {
      newState = "cancelled_after_arrival_review";

      tx.update(jobRef, {
        state: "cancelled_after_arrival_review",
        stateUpdatedAt: Date.now(),
        cancelledBy,
        cancelReasonCode: reasonCode,
        depositStatus: "under_review"
      });

      // Create leakage survey for the customer
      const surveyRef = adminDb.collection("leakageSurveys").doc();
      const surveyData: LeakageSurvey = {
        surveyId: surveyRef.id,
        jobId,
        customerId: job.customerId,
        artisanId: job.artisanId,
        arrived: true,
        fixed: "no",
        offlineSuggested: reasonCode === "technician_asked_offline" ? "technician_asked" : "no",
        comment: notes,
        createdAt: Date.now(),
        resolved: false
      };
      tx.set(surveyRef, surveyData);

      await writeJobEvent(
        jobId,
        "cancel_requested",
        actorId,
        { cancelledBy, reasonCode, notes, reviewWindowHours: config.cancellation.afterArrivalReviewHours },
        tx
      );

      await writeJobEvent(
        jobId,
        "survey_sent",
        "system",
        { surveyId: surveyRef.id, customerId: job.customerId },
        tx
      );

      return {
        newState,
        refundAmount: 0,
        feeDeducted: 0,
        artisanCompensation: 0
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 2: Cancelled AFTER en_route but BEFORE arrival
    // ──────────────────────────────────────────────────────────────────────────
    if (currentState === "en_route") {
      if (cancelledBy === "customer") {
        // Customer pays travel compensation
        const travelFee = Math.min(depositPaid, config.cancellation.customerFeeAfterEnRoute);
        artisanCompensation = travelFee;
        refundAmount = depositPaid - travelFee;

        if (artisanCompensation > 0) {
          await postLedgerEntry(tx, {
            userId: job.artisanId,
            jobId,
            type: "deposit_release_to_artisan",
            amount: artisanCompensation,
            reference: `travel_fee_${jobId}_${Date.now()}`
          });
        }
      } else {
        // Artisan cancelled on the way - full refund to customer
        refundAmount = depositPaid;
      }
    } 
    // ──────────────────────────────────────────────────────────────────────────
    // CASE 1: Cancelled BEFORE en_route
    // ──────────────────────────────────────────────────────────────────────────
    else {
      // Full refund of deposit and restore any applied customer credits
      refundAmount = depositPaid;
      usedCreditsSnap.forEach((doc) => {
        tx.update(doc.ref, {
          used: false,
          usedJobId: null,
          usedAt: null
        });
      });
    }

    tx.update(jobRef, {
      state: "cancelled",
      stateUpdatedAt: Date.now(),
      cancelledBy,
      cancelReasonCode: reasonCode,
      depositStatus: refundAmount > 0 ? "refunded" : "none"
    });

    await writeJobEvent(
      jobId,
      "state_change",
      actorId,
      { from: currentState, to: "cancelled", cancelledBy, reasonCode, refundAmount, artisanCompensation },
      tx
    );

    return {
      newState: "cancelled",
      refundAmount,
      feeDeducted,
      artisanCompensation
    };
  });
}

/**
 * Resolves an after-arrival review either when customer answers the survey or after 48h elapses.
 */
export async function resolveAfterArrivalReview(surveyId: string): Promise<{ resolved: boolean; outcome: string }> {
  const config = await getConfig();

  return await adminDb.runTransaction(async (tx) => {
    const surveyRef = adminDb.collection("leakageSurveys").doc(surveyId);
    const surveySnap = await tx.get(surveyRef);

    if (!surveySnap.exists) {
      throw new Error(`Survey ${surveyId} not found`);
    }

    const survey = surveySnap.data() as LeakageSurvey;
    if (survey.resolved) {
      return { resolved: true, outcome: survey.outcome || "already_resolved" };
    }

    const jobRef = adminDb.collection("jobRequests").doc(survey.jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) {
      throw new Error(`Job ${survey.jobId} not found`);
    }

    const surveyCreditRef = adminDb.collection("customerCredits").doc(`credit_survey_${surveyId}`);
    const surveyCreditSnap = await tx.get(surveyCreditRef);

    const job = jobSnap.data() as JobRequestData;
    const depositPaid = job.depositPaid || 0;
    let outcome = "";

    // Branch 2: Customer reports technician asked to go offline
    if (survey.offlineSuggested === "technician_asked") {
      outcome = "technician_asked_offline";
      // Refund customer in full
      // Create high-priority leakage case & strike against artisan
      const caseRef = adminDb.collection("leakageCases").doc();
      tx.set(caseRef, {
        caseId: caseRef.id,
        artisanId: job.artisanId,
        customerId: job.customerId,
        score: 50,
        reasons: ["Customer survey confirmed technician asked to handle job outside NEED"],
        status: "open",
        evidence: { surveyId, jobId: job.requestId, notes: survey.comment || "Customer reported circumvention" },
        createdAt: Date.now()
      });

      // Issue strike to artisan using the central strike ladder & blacklisting
      const { applyStrike } = await import("@/lib/strikes");
      await applyStrike({
        userId: job.artisanId,
        reason: "Customer confirmed you requested payment/completion outside the platform after arrival.",
        evidenceSummary: `Job ${job.requestId}: customer answered survey confirming offline request.`,
        adminId: "survey_resolution",
        userType: "artisan"
      });

      tx.update(jobRef, {
        depositStatus: "refunded",
        state: "cancelled",
        stateUpdatedAt: Date.now()
      });
    }
    // Branch 1: Problem could not be fixed legitimately
    else if (survey.fixed === "no" || survey.fixed === "not_attempted") {
      outcome = "legitimate_cancellation";
      const callOutFee = Math.min(depositPaid, config.cancellation.callOutFee);
      const customerRefund = depositPaid - callOutFee;

      if (callOutFee > 0) {
        await postLedgerEntry(tx, {
          userId: job.artisanId,
          jobId: job.requestId,
          type: "deposit_release_to_artisan",
          amount: callOutFee,
          reference: `callout_${job.requestId}_${Date.now()}`
        });
      }

      tx.update(jobRef, {
        depositStatus: customerRefund > 0 ? "refunded" : "forfeited_partial",
        state: "cancelled",
        stateUpdatedAt: Date.now()
      });
    }
    // Branch 3: Job was done or handled outside (collusion)
    else if (survey.fixed === "yes") {
      outcome = "handled_offline_circumvention";
      const { fee } = computeFee(job.agreedPrice || depositPaid, 1, config);
      const circumventionFee = Math.min(depositPaid, fee);
      const remainingRefund = depositPaid - circumventionFee;

      // Penalize both parties: Strike artisan AND strike customer
      const { applyStrike } = await import("@/lib/strikes");
      await applyStrike({
        userId: job.artisanId,
        reason: "Job confirmed completed offline outside of NEED.",
        evidenceSummary: `Job ${job.requestId}: survey confirmed job completed offline.`,
        adminId: "survey_resolution",
        userType: "artisan"
      });
      await applyStrike({
        userId: job.customerId,
        reason: "Colluded with technician to complete job offline outside of NEED.",
        evidenceSummary: `Job ${job.requestId}: survey confirmed job completed offline.`,
        adminId: "survey_resolution",
        userType: "customer"
      });

      tx.update(jobRef, {
        depositStatus: "forfeited_partial",
        platformFee: circumventionFee,
        commissionSettled: true,
        state: "cancelled",
        stateUpdatedAt: Date.now()
      });
    } else {
      outcome = "sent_to_admin_review";
    }

    // Award customer survey credit idempotently
    if (!surveyCreditSnap.exists && config.rewards.surveyCredit > 0) {
      tx.set(surveyCreditRef, {
        creditId: surveyCreditRef.id,
        customerId: survey.customerId,
        amount: config.rewards.surveyCredit,
        reason: "survey_completion",
        surveyId,
        used: false,
        createdAt: Date.now()
      });
    }

    tx.update(surveyRef, {
      resolved: true,
      resolvedAt: Date.now(),
      outcome
    });

    await writeJobEvent(
      job.requestId,
      "survey_answered",
      survey.customerId,
      { surveyId, outcome },
      tx
    );

    return { resolved: true, outcome };
  });
}
