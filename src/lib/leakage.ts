import { adminDb } from "./firebaseAdmin";
import { getConfig } from "./platformConfig";
import { LeakageCase, PlatformConfig } from "@/types/platform";

export interface LeakageStats {
  jobsAccepted: number;
  jobsCancelledAfterArrival: number;
  jobsWhereSurveyReportedOfflineRequest: number;
  repeatPairsWithArrivalThenCancel: number;
  highSeverityContactBlocks: number;
  mediumSeverityContactFlags: number;
  manualArrivalFarFromJobSite: number;
  suspiciouslyShortCompletedJobs: number;
}

/**
 * Computes raw and normalized leakage scores based on Section 10.3 of the roadmap.
 */
export function calculateLeakageScore(stats: LeakageStats): { rawScore: number; normalizedScore: number } {
  const rawScore =
    5 * stats.jobsCancelledAfterArrival +
    4 * stats.jobsWhereSurveyReportedOfflineRequest +
    3 * stats.repeatPairsWithArrivalThenCancel +
    2 * stats.highSeverityContactBlocks +
    1 * stats.mediumSeverityContactFlags +
    1 * stats.manualArrivalFarFromJobSite +
    1 * stats.suspiciouslyShortCompletedJobs;

  const normalizer = Math.max(1, stats.jobsAccepted / 10);
  const normalizedScore = parseFloat((rawScore / normalizer).toFixed(2));

  return { rawScore, normalizedScore };
}

/**
 * Computes leakage signals for an artisan over the configurable rolling window.
 */
export async function computeArtisanLeakageMetrics(
  artisanId: string,
  config?: PlatformConfig
): Promise<{ stats: LeakageStats; normalizedScore: number; classification: "normal" | "watch" | "review" }> {
  const cfg = config || (await getConfig());
  const windowDays = cfg.leakage.windowDays || 30;
  const sinceTimestamp = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  // 1. Fetch jobs in window
  const jobsSnap = await adminDb
    .collection("jobRequests")
    .where("artisanId", "==", artisanId)
    .where("createdAt", ">=", sinceTimestamp)
    .get();

  const jobs = jobsSnap.docs.map(d => d.data());
  const jobsAccepted = jobs.filter(j => j.state !== "requested" && j.state !== "negotiating").length;

  const jobsCancelledAfterArrival = jobs.filter(
    j => j.state === "cancelled_after_arrival_review" || (j.state === "cancelled" && j.arrivedAt)
  ).length;

  const manualArrivalFarFromJobSite = jobs.filter(
    j => j.arrivalSource === "manual" && j.manualArrivalDistanceMeters && j.manualArrivalDistanceMeters > (cfg.arrival.radiusMeters * 2)
  ).length;

  const suspiciouslyShortCompletedJobs = jobs.filter(
    j => j.state === "completed" && j.completedAt && j.arrivedAt && (j.completedAt - j.arrivedAt < 5 * 60 * 1000)
  ).length;

  // 2. Fetch surveys reporting offline requests
  const surveysSnap = await adminDb
    .collection("leakageSurveys")
    .where("artisanId", "==", artisanId)
    .where("createdAt", ">=", sinceTimestamp)
    .get();

  const surveys = surveysSnap.docs.map(d => d.data());
  const jobsWhereSurveyReportedOfflineRequest = surveys.filter(
    s => s.offlineSuggested === "technician_asked"
  ).length;

  // 3. Repeat pairs with arrival then cancel
  const customerCancelCounts: Record<string, number> = {};
  for (const j of jobs) {
    if (j.arrivedAt && (j.state === "cancelled" || j.state === "cancelled_after_arrival_review")) {
      customerCancelCounts[j.customerId] = (customerCancelCounts[j.customerId] || 0) + 1;
    }
  }
  const repeatPairsWithArrivalThenCancel = Object.values(customerCancelCounts).filter(c => c >= 2).length;

  // 4. Contact attempts
  const contactSnap = await adminDb
    .collection("contactAttempts")
    .where("senderId", "==", artisanId)
    .where("at", ">=", sinceTimestamp)
    .get();

  const contactAttempts = contactSnap.docs.map(d => d.data());
  const highSeverityContactBlocks = contactAttempts.filter(c => c.severity === "high").length;
  const mediumSeverityContactFlags = contactAttempts.filter(c => c.severity === "medium").length;

  const stats: LeakageStats = {
    jobsAccepted,
    jobsCancelledAfterArrival,
    jobsWhereSurveyReportedOfflineRequest,
    repeatPairsWithArrivalThenCancel,
    highSeverityContactBlocks,
    mediumSeverityContactFlags,
    manualArrivalFarFromJobSite,
    suspiciouslyShortCompletedJobs
  };

  const { normalizedScore } = calculateLeakageScore(stats);

  let classification: "normal" | "watch" | "review" = "normal";
  if (normalizedScore >= cfg.leakage.reviewScore) {
    classification = "review";
  } else if (normalizedScore >= cfg.leakage.watchScore) {
    classification = "watch";
  }

  return { stats, normalizedScore, classification };
}

/**
 * Runs nightly leakage analysis across all active artisans.
 * Creates leakage cases when score exceeds review threshold.
 */
export async function runNightlyLeakageDetection(): Promise<{ evaluated: number; casesCreated: number }> {
  const config = await getConfig();
  const artisansSnap = await adminDb.collection("artisans").get();

  let casesCreated = 0;

  for (const doc of artisansSnap.docs) {
    const artisanId = doc.id;
    try {
      const { stats, normalizedScore, classification } = await computeArtisanLeakageMetrics(artisanId, config);

      // Update artisan record with tracking info
      await adminDb.collection("artisans").doc(artisanId).set(
        {
          leakageScore: normalizedScore,
          leakageClassification: classification,
          lastLeakageCheckAt: Date.now()
        },
        { merge: true }
      );

      if (classification === "review") {
        // Check if an open case already exists to avoid duplicates
        const openCasesSnap = await adminDb
          .collection("leakageCases")
          .where("artisanId", "==", artisanId)
          .where("status", "in", ["open", "under_review"])
          .limit(1)
          .get();

        if (openCasesSnap.empty) {
          const caseRef = adminDb.collection("leakageCases").doc();
          const newCase: LeakageCase = {
            caseId: caseRef.id,
            artisanId,
            score: normalizedScore,
            reasons: [
              ...(stats.jobsCancelledAfterArrival > 0 ? [`${stats.jobsCancelledAfterArrival} jobs cancelled after arrival`] : []),
              ...(stats.jobsWhereSurveyReportedOfflineRequest > 0 ? [`${stats.jobsWhereSurveyReportedOfflineRequest} surveys reported technician asked offline`] : []),
              ...(stats.repeatPairsWithArrivalThenCancel > 0 ? [`${stats.repeatPairsWithArrivalThenCancel} repeat pairs cancelled after arrival`] : []),
              ...(stats.highSeverityContactBlocks > 0 ? [`${stats.highSeverityContactBlocks} contact details blocked in chat`] : []),
              ...(stats.manualArrivalFarFromJobSite > 0 ? [`${stats.manualArrivalFarFromJobSite} manual arrivals far from location`] : [])
            ],
            status: "open",
            evidence: {
              stats,
              notes: `Automated detection created case with normalized leakage score of ${normalizedScore}`
            },
            createdAt: Date.now()
          };

          await caseRef.set(newCase);
          casesCreated++;
        }
      }
    } catch (err) {
      console.error(`Error computing leakage for artisan ${artisanId}:`, err);
    }
  }

  return { evaluated: artisansSnap.size, casesCreated };
}
