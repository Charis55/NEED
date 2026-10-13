import {
  Wallet,
  WalletTransaction,
  LedgerDiscrepancy,
  ReconciliationReport,
  Kobo,
  JobRequestData
} from "@/types/platform";

/**
 * Calculates the mathematically expected wallet balance from an array of append-only transactions.
 * Handles credit vs debit transaction types and signs.
 */
export function calculateExpectedWalletBalance(transactions: WalletTransaction[]): Kobo {
  let balance: Kobo = 0;
  for (const tx of transactions) {
    const amount = tx.amount || 0;
    switch (tx.type) {
      case "deposit_release_to_artisan":
      case "topup":
      case "withdrawal_reversal":
        balance += Math.abs(amount);
        break;
      case "commission_charge":
      case "cash_commission_charge":
      case "withdrawal":
      case "refund_debit":
      case "guarantee_clawback":
        balance -= Math.abs(amount);
        break;
      case "adjustment_admin":
        // Admin adjustments preserve their explicit sign
        balance += amount;
        break;
      default:
        balance += amount;
        break;
    }
  }
  return balance;
}

/**
 * Audits a single user wallet against its transaction history.
 */
export function auditWallet(wallet: Wallet, transactions: WalletTransaction[]) {
  const expectedBalance = calculateExpectedWalletBalance(transactions);
  const actualBalance = wallet.balance || 0;
  const difference = actualBalance - expectedBalance;
  const isMatch = actualBalance === expectedBalance;

  return {
    isMatch,
    expectedBalance,
    actualBalance,
    difference,
  };
}

/**
 * Compares total customer deposits held in escrow against available Paystack balance.
 */
export function auditEscrowReserve(
  totalHeldEscrowKobo: Kobo,
  paystackBalanceKobo: Kobo | null
) {
  if (paystackBalanceKobo === null) {
    return {
      hasShortfall: false,
      shortfallKobo: 0,
      totalHeldEscrowKobo,
      paystackBalanceKobo: null,
    };
  }

  const shortfallKobo = Math.max(0, totalHeldEscrowKobo - paystackBalanceKobo);
  return {
    hasShortfall: shortfallKobo > 0,
    shortfallKobo,
    totalHeldEscrowKobo,
    paystackBalanceKobo,
  };
}

export interface RunReconciliationAuditParams {
  wallets: Wallet[];
  transactionsByUser: Record<string, WalletTransaction[]>;
  heldEscrowJobs: Array<{ requestId: string; depositPaid: Kobo }>;
  paystackBalanceKobo: Kobo | null;
  now?: number;
}

/**
 * Pure reconciliation runner:
 * Audits every user wallet and verifies platform escrow reserve.
 * Invariant: Never silently alter money. Any discrepancy is flagged and returned.
 */
export function runReconciliationAudit(params: RunReconciliationAuditParams): {
  report: ReconciliationReport;
  newDiscrepancies: LedgerDiscrepancy[];
} {
  const {
    wallets,
    transactionsByUser,
    heldEscrowJobs,
    paystackBalanceKobo,
    now = Date.now(),
  } = params;

  const newDiscrepancies: LedgerDiscrepancy[] = [];
  let walletsMismatched = 0;

  // 1. Audit each wallet against its transaction ledger
  for (const wallet of wallets) {
    const userTxs = transactionsByUser[wallet.userId] || [];
    const audit = auditWallet(wallet, userTxs);

    if (!audit.isMatch) {
      walletsMismatched++;
      const absDiff = Math.abs(audit.difference);
      const severity: LedgerDiscrepancy["severity"] =
        absDiff >= 1000000 ? "critical" : absDiff >= 100000 ? "high" : "medium";

      newDiscrepancies.push({
        discrepancyId: `disc_wallet_${wallet.userId}_${now}`,
        type: "wallet_sum_mismatch",
        userId: wallet.userId,
        expectedBalance: audit.expectedBalance,
        actualBalance: audit.actualBalance,
        difference: audit.difference,
        details: `Wallet balance (₦${(audit.actualBalance / 100).toLocaleString()}) does not match sum of transactions (₦${(audit.expectedBalance / 100).toLocaleString()}). Variance: ₦${(audit.difference / 100).toLocaleString()}.`,
        severity,
        status: "open",
        createdAt: now,
      });
    }
  }

  // 2. Audit total held platform escrow against Paystack balance
  const totalHeldEscrowKobo = heldEscrowJobs.reduce(
    (sum, job) => sum + (job.depositPaid || 0),
    0
  );

  const escrowAudit = auditEscrowReserve(totalHeldEscrowKobo, paystackBalanceKobo);

  if (escrowAudit.hasShortfall) {
    newDiscrepancies.push({
      discrepancyId: `disc_escrow_shortfall_${now}`,
      type: "escrow_reserve_mismatch",
      totalHeldEscrow: totalHeldEscrowKobo,
      paystackBalance: paystackBalanceKobo ?? 0,
      difference: escrowAudit.shortfallKobo,
      details: `Paystack settlement account balance (₦${((paystackBalanceKobo ?? 0) / 100).toLocaleString()}) is less than active platform escrow holdings (₦${(totalHeldEscrowKobo / 100).toLocaleString()}). Deficit: ₦${(escrowAudit.shortfallKobo / 100).toLocaleString()}.`,
      severity: "critical",
      status: "open",
      createdAt: now,
    });
  }

  const reportId = `recon_report_${now}`;
  const report: ReconciliationReport = {
    reportId,
    timestamp: now,
    walletsChecked: wallets.length,
    walletsMismatched,
    totalHeldEscrowKobo,
    paystackBalanceKobo,
    escrowShortfallKobo: escrowAudit.shortfallKobo,
    discrepanciesCount: newDiscrepancies.length,
    discrepancyIds: newDiscrepancies.map((d) => d.discrepancyId),
    status: newDiscrepancies.length === 0 ? "clean" : "discrepancies_detected",
  };

  return {
    report,
    newDiscrepancies,
  };
}
