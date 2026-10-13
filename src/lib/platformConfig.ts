import { PlatformConfig } from "@/types/platform";
import { adminDb } from "./firebaseAdmin";

export const defaultPlatformConfig: PlatformConfig = {
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
  escrowEnabled: false,                    // Requires Nigerian legal advice before turning on
  autoConfirmHours: 24,
  walletCreditLimit: 300000,               // N3,000 (in kobo)
  overdueCommissionDays: 7,
  cancellation: {
    customerFreeBeforeEnRouteMinutes: 60,
    customerFeeAfterEnRoute: 150000,       // N1,500 (in kobo)
    afterArrivalReviewHours: 48,
    callOutFee: 150000,                    // N1,500 (in kobo)
  },
  guarantee: { windowDays: 30, enabled: true },
  arrival: { radiusMeters: 300, consecutivePings: 3, pingSeconds: 30 },
  leakage: { watchScore: 10, reviewScore: 20, windowDays: 30 },
  rewards: { inAppPaymentCredit: 30000, surveyCredit: 10000 }, // N300, N100
  chat: { blockPhoneNumbers: true, blockHandles: true }
};

let cachedConfig: PlatformConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Returns current platform config with a 60-second in-memory cache.
 * Falls back to defaultPlatformConfig if Firestore is unavailable.
 */
export async function getConfig(): Promise<PlatformConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const docSnap = await adminDb.collection("platformConfig").doc("current").get();
    if (docSnap.exists) {
      cachedConfig = {
        ...defaultPlatformConfig,
        ...(docSnap.data() as Partial<PlatformConfig>)
      };
      lastFetchTime = now;
      return cachedConfig;
    }
  } catch (error) {
    console.warn("Failed to fetch platformConfig/current, falling back to defaults:", error);
  }

  cachedConfig = defaultPlatformConfig;
  lastFetchTime = now;
  return cachedConfig;
}

/**
 * Updates platform config by creating a new version, updating current, and logging to auditLog.
 */
export async function updatePlatformConfig(
  newConfig: Partial<PlatformConfig>,
  adminId: string,
  note?: string
): Promise<PlatformConfig> {
  const current = await getConfig();
  const nextVersion = (current.version || 1) + 1;

  const merged: PlatformConfig = {
    ...current,
    ...newConfig,
    version: nextVersion
  };

  const batch = adminDb.batch();
  
  // 1. Update current
  const currentRef = adminDb.collection("platformConfig").doc("current");
  batch.set(currentRef, merged);

  // 2. Version history
  const historyRef = adminDb.collection("platformConfig").doc(`v${nextVersion}`);
  batch.set(historyRef, { ...merged, archivedAt: Date.now(), updatedBy: adminId, note: note || "Config update" });

  // 3. Audit log
  const auditRef = adminDb.collection("auditLog").doc();
  batch.set(auditRef, {
    id: auditRef.id,
    type: "config_updated",
    actorId: adminId,
    before: current,
    after: merged,
    note: note || "Platform config updated",
    at: Date.now()
  });

  await batch.commit();

  // Invalidate cache immediately
  cachedConfig = merged;
  lastFetchTime = Date.now();

  return merged;
}
