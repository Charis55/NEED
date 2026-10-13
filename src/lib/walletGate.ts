import { adminDb } from "./firebaseAdmin";
import { getConfig } from "./platformConfig";
import { Wallet } from "@/types/platform";

export interface WalletGateCheck {
  canAccept: boolean;
  reason?: "negative_balance" | "overdue_commission" | "suspended" | "account_inactive";
  message?: string;
  currentBalance: number;
  creditLimit: number;
}

/**
 * Checks whether an artisan is eligible to accept new jobs based on wallet balance and overdue commissions.
 * Throws an Error if assertion fails, or returns the validation result.
 */
export async function assertArtisanCanAcceptJobs(userId: string): Promise<WalletGateCheck> {
  const config = await getConfig();

  // 1. Fetch wallet doc
  const walletRef = adminDb.collection("wallets").doc(userId);
  const walletSnap = await walletRef.get();

  const creditLimit = walletSnap.exists
    ? (walletSnap.data()?.creditLimit ?? config.walletCreditLimit)
    : config.walletCreditLimit;

  const balance = walletSnap.exists ? (walletSnap.data()?.balance ?? 0) : 0;
  const blockedReason = walletSnap.exists ? walletSnap.data()?.blockedReason : "none";

  // Check 1: Suspension
  if (blockedReason === "suspended") {
    const errorMsg = "Your account is temporarily suspended from accepting new jobs. Please check your notices.";
    return {
      canAccept: false,
      reason: "suspended",
      message: errorMsg,
      currentBalance: balance,
      creditLimit
    };
  }

  // Check 2: Exceeded credit limit
  if (balance < -creditLimit) {
    const errorMsg = `You cannot accept new jobs because your commission balance (-₦${Math.abs(balance / 100).toLocaleString()}) exceeds your credit limit (₦${(creditLimit / 100).toLocaleString()}). Please top up your wallet.`;
    return {
      canAccept: false,
      reason: "negative_balance",
      message: errorMsg,
      currentBalance: balance,
      creditLimit
    };
  }

  // Check 3: Overdue commission charge
  const overdueDays = config.overdueCommissionDays || 7;
  const overdueCutoff = Date.now() - overdueDays * 24 * 60 * 60 * 1000;

  // Query unrecovered commission charges older than overdueDays
  const oldChargesSnap = await adminDb
    .collection("walletTransactions")
    .where("userId", "==", userId)
    .where("type", "==", "commission_charge")
    .where("createdAt", "<=", overdueCutoff)
    .get();

  if (!oldChargesSnap.empty && balance < 0) {
    const errorMsg = `You have outstanding commission older than ${overdueDays} days. Please top up your wallet to continue receiving requests.`;
    return {
      canAccept: false,
      reason: "overdue_commission",
      message: errorMsg,
      currentBalance: balance,
      creditLimit
    };
  }

  return {
    canAccept: true,
    currentBalance: balance,
    creditLimit
  };
}
