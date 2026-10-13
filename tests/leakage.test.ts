import assert from "node:assert";
import test from "node:test";
import { calculateLeakageScore, LeakageStats } from "../src/lib/leakage";

test("leakage scoring - honest artisan with zero incidents produces 0 score", () => {
  const honestStats: LeakageStats = {
    jobsAccepted: 15,
    jobsCancelledAfterArrival: 0,
    jobsWhereSurveyReportedOfflineRequest: 0,
    repeatPairsWithArrivalThenCancel: 0,
    highSeverityContactBlocks: 0,
    mediumSeverityContactFlags: 0,
    manualArrivalFarFromJobSite: 0,
    suspiciouslyShortCompletedJobs: 0
  };

  const { normalizedScore } = calculateLeakageScore(honestStats);
  assert.strictEqual(normalizedScore, 0);
});

test("leakage scoring - leaking artisan crossing review threshold", () => {
  // Artisan with multiple arrival cancellations, survey reports, and contact blocks
  const leakingStats: LeakageStats = {
    jobsAccepted: 10,
    jobsCancelledAfterArrival: 4,      // 4 * 5 = 20
    jobsWhereSurveyReportedOfflineRequest: 2, // 2 * 4 = 8
    repeatPairsWithArrivalThenCancel: 1,      // 1 * 3 = 3
    highSeverityContactBlocks: 2,             // 2 * 2 = 4
    mediumSeverityContactFlags: 1,            // 1 * 1 = 1
    manualArrivalFarFromJobSite: 1,           // 1 * 1 = 1
    suspiciouslyShortCompletedJobs: 0
  };
  // rawScore = 20 + 8 + 3 + 4 + 1 + 1 = 37
  // normalizer = max(1, 10 / 10) = 1
  // normalizedScore = 37

  const { rawScore, normalizedScore } = calculateLeakageScore(leakingStats);
  assert.strictEqual(rawScore, 37);
  assert.strictEqual(normalizedScore, 37);
  assert.ok(normalizedScore >= 20, "Should exceed reviewScore threshold (20)");
});

test("leakage scoring - busy honest artisan is normalized and does not get falsely flagged", () => {
  // Busy artisan with 100 jobs, 2 legitimate cancellations after arrival
  const busyArtisanStats: LeakageStats = {
    jobsAccepted: 100,
    jobsCancelledAfterArrival: 2, // 2 * 5 = 10
    jobsWhereSurveyReportedOfflineRequest: 0,
    repeatPairsWithArrivalThenCancel: 0,
    highSeverityContactBlocks: 0,
    mediumSeverityContactFlags: 1, // 1 * 1 = 1
    manualArrivalFarFromJobSite: 0,
    suspiciouslyShortCompletedJobs: 0
  };
  // rawScore = 11
  // normalizer = max(1, 100 / 10) = 10
  // normalizedScore = 11 / 10 = 1.1

  const { normalizedScore } = calculateLeakageScore(busyArtisanStats);
  assert.strictEqual(normalizedScore, 1.1);
  assert.ok(normalizedScore < 10, "Should be far below watchScore threshold (10)");
});
