import { PlatformConfig } from "@/types/platform";

export const defaultPlatformConfig: PlatformConfig = {
  version: 1,
  feeTiers: [
    { upToPairJobNumber: 1, ratePercent: 15 },
    { upToPairJobNumber: 2, ratePercent: 10 },
    { upToPairJobNumber: 999, ratePercent: 6 }
  ],
  minimumFee: 50000,                       // N500 (in kobo)
  depositPercent: 25,
  depositMinimum: 100000,                  // N1,000 (in kobo)
  depositWindowMinutes: 30,
  requireDeposit: true,
  escrowEnabled: false,                    // To be verified by a lawyer
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
