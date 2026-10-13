import assert from "node:assert";
import test from "node:test";
import {
  calculateExpectedWalletBalance,
  auditWallet,
  auditEscrowReserve,
  runReconciliationAudit,
} from "../src/lib/reconciliation";
import { Wallet, WalletTransaction } from "../src/types/platform";

test("Reconciliation - calculateExpectedWalletBalance pure math", () => {
  // Case 1: Empty ledger
  assert.strictEqual(calculateExpectedWalletBalance([]), 0);

  // Case 2: Credits only (deposit release, topup, withdrawal reversal)
  const creditTxs: WalletTransaction[] = [
    {
      txId: "tx_1",
      userId: "art_1",
      jobId: "job_1",
      type: "deposit_release_to_artisan",
      amount: 500000, // ₦5,000
      balanceAfter: 500000,
      reference: "ref_1",
      createdAt: 1000,
    },
    {
      txId: "tx_2",
      userId: "art_1",
      jobId: null,
      type: "topup",
      amount: 200000, // ₦2,000
      balanceAfter: 700000,
      reference: "ref_2",
      createdAt: 2000,
    },
    {
      txId: "tx_3",
      userId: "art_1",
      jobId: null,
      type: "withdrawal_reversal",
      amount: 100000, // ₦1,000
      balanceAfter: 800000,
      reference: "ref_3",
      createdAt: 3000,
    },
  ];
  assert.strictEqual(calculateExpectedWalletBalance(creditTxs), 800000);

  // Case 3: Debits (commission charge, withdrawal, clawback)
  const debitTxs: WalletTransaction[] = [
    {
      txId: "tx_4",
      userId: "art_1",
      jobId: "job_1",
      type: "commission_charge",
      amount: 150000, // ₦1,500
      balanceAfter: -150000,
      reference: "ref_4",
      createdAt: 4000,
    },
    {
      txId: "tx_5",
      userId: "art_1",
      jobId: null,
      type: "withdrawal",
      amount: 300000, // ₦3,000
      balanceAfter: -450000,
      reference: "ref_5",
      createdAt: 5000,
    },
    {
      txId: "tx_6",
      userId: "art_1",
      jobId: "job_2",
      type: "guarantee_clawback",
      amount: 200000, // ₦2,000
      balanceAfter: -650000,
      reference: "ref_6",
      createdAt: 6000,
    },
  ];
  assert.strictEqual(calculateExpectedWalletBalance(debitTxs), -650000);

  // Case 4: Admin adjustments preserve explicit sign
  const adminTxs: WalletTransaction[] = [
    {
      txId: "tx_7",
      userId: "art_1",
      jobId: null,
      type: "adjustment_admin",
      amount: 50000, // +₦500
      balanceAfter: 50000,
      reference: "ref_7",
      createdAt: 7000,
    },
    {
      txId: "tx_8",
      userId: "art_1",
      jobId: null,
      type: "adjustment_admin",
      amount: -120000, // -₦1,200
      balanceAfter: -70000,
      reference: "ref_8",
      createdAt: 8000,
    },
  ];
  assert.strictEqual(calculateExpectedWalletBalance(adminTxs), -70000);

  // Case 5: Combined stream
  const allTxs = [...creditTxs, ...debitTxs, ...adminTxs];
  // 800,000 - 650,000 - 70,000 = 80,000
  assert.strictEqual(calculateExpectedWalletBalance(allTxs), 80000);
});

test("Reconciliation - auditWallet matching and tamper detection", () => {
  const userTxs: WalletTransaction[] = [
    {
      txId: "tx_10",
      userId: "art_10",
      jobId: "job_10",
      type: "deposit_release_to_artisan",
      amount: 1000000,
      balanceAfter: 1000000,
      reference: "ref_10",
      createdAt: 1000,
    },
    {
      txId: "tx_11",
      userId: "art_10",
      jobId: "job_10",
      type: "commission_charge",
      amount: 150000,
      balanceAfter: 850000,
      reference: "ref_11",
      createdAt: 2000,
    },
  ];

  // 1. Matched wallet
  const honestWallet: Wallet = {
    userId: "art_10",
    balance: 850000,
    pendingEarnings: 0,
    creditLimit: 300000,
    blockedReason: "none",
    updatedAt: 2000,
  };
  const matchAudit = auditWallet(honestWallet, userTxs);
  assert.strictEqual(matchAudit.isMatch, true);
  assert.strictEqual(matchAudit.difference, 0);
  assert.strictEqual(matchAudit.expectedBalance, 850000);
  assert.strictEqual(matchAudit.actualBalance, 850000);

  // 2. Tampered or mismatched wallet (e.g. balance is 950,000 due to out-of-band write)
  const tamperedWallet: Wallet = {
    userId: "art_10",
    balance: 950000,
    pendingEarnings: 0,
    creditLimit: 300000,
    blockedReason: "none",
    updatedAt: 2000,
  };
  const mismatchAudit = auditWallet(tamperedWallet, userTxs);
  assert.strictEqual(mismatchAudit.isMatch, false);
  assert.strictEqual(mismatchAudit.difference, 100000); // ₦1,000 over expected
  assert.strictEqual(mismatchAudit.expectedBalance, 850000);
  assert.strictEqual(mismatchAudit.actualBalance, 950000);
});

test("Reconciliation - auditEscrowReserve shortfall checks", () => {
  // Case 1: Paystack balance is null (simulation or API offline)
  const nullCheck = auditEscrowReserve(5000000, null);
  assert.strictEqual(nullCheck.hasShortfall, false);
  assert.strictEqual(nullCheck.shortfallKobo, 0);

  // Case 2: Solvency (Held escrow ₦50,000 <= Paystack reserve ₦80,000)
  const solventCheck = auditEscrowReserve(5000000, 8000000);
  assert.strictEqual(solventCheck.hasShortfall, false);
  assert.strictEqual(solventCheck.shortfallKobo, 0);

  // Case 3: Exact match (Held escrow ₦50,000 == Paystack reserve ₦50,000)
  const exactCheck = auditEscrowReserve(5000000, 5000000);
  assert.strictEqual(exactCheck.hasShortfall, false);
  assert.strictEqual(exactCheck.shortfallKobo, 0);

  // Case 4: Reserve Deficit (Held escrow ₦100,000 > Paystack reserve ₦60,000)
  const deficitCheck = auditEscrowReserve(10000000, 6000000);
  assert.strictEqual(deficitCheck.hasShortfall, true);
  assert.strictEqual(deficitCheck.shortfallKobo, 4000000); // ₦40,000 deficit
});

test("Reconciliation - runReconciliationAudit comprehensive suite", () => {
  const now = 1700000000000;

  const wallets: Wallet[] = [
    { userId: "art_ok", balance: 500000, pendingEarnings: 0, creditLimit: 300000, blockedReason: "none", updatedAt: now },
    { userId: "art_bad", balance: 800000, pendingEarnings: 0, creditLimit: 300000, blockedReason: "none", updatedAt: now },
  ];

  const transactionsByUser: Record<string, WalletTransaction[]> = {
    art_ok: [
      {
        txId: "tx_ok",
        userId: "art_ok",
        jobId: null,
        type: "topup",
        amount: 500000,
        balanceAfter: 500000,
        reference: "ref_ok",
        createdAt: now,
      },
    ],
    art_bad: [
      {
        txId: "tx_bad",
        userId: "art_bad",
        jobId: null,
        type: "topup",
        amount: 500000, // Should be 500,000, but wallet has 800,000 (+300,000 variance)
        balanceAfter: 500000,
        reference: "ref_bad",
        createdAt: now,
      },
    ],
  };

  const heldEscrowJobs = [
    { requestId: "req_1", depositPaid: 2000000 },
    { requestId: "req_2", depositPaid: 1500000 },
  ]; // Total held escrow: 3,500,000 kobo (₦35,000)

  // 1. Audit with Reserve Deficit: Paystack only has 2,000,000 kobo (₦20,000)
  const resultWithDeficit = runReconciliationAudit({
    wallets,
    transactionsByUser,
    heldEscrowJobs,
    paystackBalanceKobo: 2000000,
    now,
  });

  assert.strictEqual(resultWithDeficit.report.status, "discrepancies_detected");
  assert.strictEqual(resultWithDeficit.report.walletsChecked, 2);
  assert.strictEqual(resultWithDeficit.report.walletsMismatched, 1);
  assert.strictEqual(resultWithDeficit.report.totalHeldEscrowKobo, 3500000);
  assert.strictEqual(resultWithDeficit.report.escrowShortfallKobo, 1500000);
  assert.strictEqual(resultWithDeficit.newDiscrepancies.length, 2);

  // Check wallet discrepancy details
  const walletDisc = resultWithDeficit.newDiscrepancies.find((d) => d.type === "wallet_sum_mismatch");
  assert.ok(walletDisc);
  assert.strictEqual(walletDisc.userId, "art_bad");
  assert.strictEqual(walletDisc.expectedBalance, 500000);
  assert.strictEqual(walletDisc.actualBalance, 800000);
  assert.strictEqual(walletDisc.difference, 300000);
  assert.strictEqual(walletDisc.severity, "high"); // ₦3,000 >= ₦1,000 threshold

  // Check escrow shortfall discrepancy details
  const escrowDisc = resultWithDeficit.newDiscrepancies.find((d) => d.type === "escrow_reserve_mismatch");
  assert.ok(escrowDisc);
  assert.strictEqual(escrowDisc.difference, 1500000);
  assert.strictEqual(escrowDisc.severity, "critical");

  // 2. Audit with Solvent Balances and Honest Wallets
  const cleanWallets: Wallet[] = [
    { userId: "art_ok", balance: 500000, pendingEarnings: 0, creditLimit: 300000, blockedReason: "none", updatedAt: now },
  ];
  const cleanResult = runReconciliationAudit({
    wallets: cleanWallets,
    transactionsByUser: { art_ok: transactionsByUser.art_ok },
    heldEscrowJobs,
    paystackBalanceKobo: 5000000, // ₦50,000 >= ₦35,000 held
    now,
  });

  assert.strictEqual(cleanResult.report.status, "clean");
  assert.strictEqual(cleanResult.report.walletsChecked, 1);
  assert.strictEqual(cleanResult.report.walletsMismatched, 0);
  assert.strictEqual(cleanResult.report.escrowShortfallKobo, 0);
  assert.strictEqual(cleanResult.newDiscrepancies.length, 0);
});
