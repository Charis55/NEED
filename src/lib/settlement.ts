import { adminDb } from "./firebaseAdmin";
import { getConfig } from "./platformConfig";
import { computeFee } from "./feeEngine";
import { postLedgerEntry } from "./ledger";
import { writeJobEvent } from "./jobEvents";
import { JobRequestData, WalletTransaction } from "@/types/platform";

/**
 * Executes atomic job settlement in a single Firestore transaction according to Section 5.5.
 */
export async function settleJob(jobId: string): Promise<{ success: boolean; platformFee: number; artisanCredited: number; feeShortfall: number }> {
  const config = await getConfig();

  return await adminDb.runTransaction(async (tx) => {
    const jobRef = adminDb.collection("jobRequests").doc(jobId);
    const jobSnap = await tx.get(jobRef);

    if (!jobSnap.exists) {
      throw new Error(`Job ${jobId} not found`);
    }

    const job = jobSnap.data() as JobRequestData;

    if (job.commissionSettled) {
      return { success: true, platformFee: job.platformFee || 0, artisanCredited: 0, feeShortfall: 0 };
    }

    const finalPrice = job.finalPrice || job.agreedPrice || 0;
    const depositPaid = job.depositPaid || 0;

    // 1. Get or initialize pair completed count
    const pairId = `${job.customerId}_${job.artisanId}`;
    const pairRef = adminDb.collection("pairs").doc(pairId);
    const pairSnap = await tx.get(pairRef);
    const completedCount = pairSnap.exists ? (pairSnap.data()?.completedCount || 0) : 0;
    const pairJobNumber = completedCount + 1;

    // 2. Compute platform fee
    const { fee, ratePercent } = computeFee(finalPrice, pairJobNumber, config);

    // 3. Platform takes fee from deposit first
    const feeFromDeposit = Math.min(fee, depositPaid);
    const depositRemainderToArtisan = depositPaid - feeFromDeposit;
    const feeShortfall = fee - feeFromDeposit;

    // 4. Post ledger entries
    if (depositRemainderToArtisan > 0) {
      await postLedgerEntry(tx, {
        userId: job.artisanId,
        jobId,
        type: "deposit_release_to_artisan",
        amount: depositRemainderToArtisan,
        reference: `dep_rel_${jobId}_${Date.now()}`
      });
    }

    if (feeShortfall > 0) {
      await postLedgerEntry(tx, {
        userId: job.artisanId,
        jobId,
        type: "commission_charge",
        amount: -feeShortfall,
        reference: `comm_charge_${jobId}_${Date.now()}`
      });
    }

    // 5. Update job document
    tx.update(jobRef, {
      platformFee: fee,
      feeRatePercentApplied: ratePercent,
      pairJobNumber,
      commissionSettled: true,
      depositStatus: "released",
      completedAt: job.completedAt || Date.now(),
      state: "completed",
      stateUpdatedAt: Date.now()
    });

    // 6. Update pair statistics
    const currentTotalValue = pairSnap.exists ? (pairSnap.data()?.totalValue || 0) : 0;
    tx.set(pairRef, {
      pairId,
      customerId: job.customerId,
      artisanId: job.artisanId,
      completedCount: completedCount + 1,
      lastCompletedAt: Date.now(),
      totalValue: currentTotalValue + finalPrice
    }, { merge: true });

    // 7. Write timeline events
    await writeJobEvent(
      jobId,
      "payout_released",
      "system",
      { artisanCredited: depositRemainderToArtisan, finalPrice, fee },
      tx
    );

    if (fee > 0) {
      await writeJobEvent(
        jobId,
        "commission_charged",
        "system",
        { platformFee: fee, feeFromDeposit, feeShortfall, ratePercent },
        tx
      );
    }

    return {
      success: true,
      platformFee: fee,
      artisanCredited: depositRemainderToArtisan,
      feeShortfall
    };
  });
}

/**
 * Scheduled function to expire jobs awaiting deposit past the deposit window.
 */
export async function expireUnpaidDeposits(): Promise<number> {
  const config = await getConfig();
  const windowMs = (config.depositWindowMinutes || 30) * 60 * 1000;
  const cutoffTime = Date.now() - windowMs;

  const expiredSnap = await adminDb
    .collection("jobRequests")
    .where("state", "==", "awaiting_deposit")
    .where("stateUpdatedAt", "<=", cutoffTime)
    .get();

  let expiredCount = 0;

  for (const doc of expiredSnap.docs) {
    const job = doc.data() as JobRequestData;
    // Expire and cancel
    await adminDb.runTransaction(async (tx) => {
      tx.update(doc.ref, {
        state: "cancelled",
        stateUpdatedAt: Date.now(),
        cancelledBy: "system",
        cancelReasonCode: "deposit_window_expired"
      });

      await writeJobEvent(
        job.requestId,
        "state_change",
        "system",
        { from: "awaiting_deposit", to: "cancelled", guard: "depositWindowExpired" },
        tx
      );
    });
    expiredCount++;
  }

  return expiredCount;
}

/**
 * Scheduled function to auto-confirm jobs in awaiting_customer_confirmation past the deadline.
 */
export async function autoConfirmCompletions(): Promise<number> {
  const now = Date.now();

  const dueSnap = await adminDb
    .collection("jobRequests")
    .where("state", "==", "awaiting_customer_confirmation")
    .where("autoConfirmAt", "<=", now)
    .get();

  let confirmedCount = 0;

  for (const doc of dueSnap.docs) {
    const job = doc.data() as JobRequestData;
    // Auto confirm and settle
    await adminDb.runTransaction(async (tx) => {
      tx.update(doc.ref, {
        customerConfirmedAt: now,
        state: "completed",
        stateUpdatedAt: now
      });

      await writeJobEvent(
        job.requestId,
        "state_change",
        "system",
        { from: "awaiting_customer_confirmation", to: "completed", guard: "autoConfirmElapsed" },
        tx
      );
    });

    // Settle after state change
    await settleJob(job.requestId);
    confirmedCount++;
  }

  return confirmedCount;
}

/**
 * Nightly reconciliation function: verifies for each wallet that balance === sum(transactions).
 */
export async function reconcileLedger(): Promise<{ checked: number; discrepancies: any[] }> {
  const walletsSnap = await adminDb.collection("wallets").get();
  const discrepancies: any[] = [];

  for (const wDoc of walletsSnap.docs) {
    const wallet = wDoc.data();
    const userId = wDoc.id;

    const txSnap = await adminDb
      .collection("walletTransactions")
      .where("userId", "==", userId)
      .get();

    const sum = txSnap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0);
    const recordedBalance = wallet.balance || 0;

    if (sum !== recordedBalance) {
      const discrepancy = {
        userId,
        recordedBalance,
        computedSum: sum,
        difference: recordedBalance - sum,
        detectedAt: Date.now()
      };
      discrepancies.push(discrepancy);

      // Log alert in auditLog
      await adminDb.collection("auditLog").add({
        type: "ledger_reconciliation_error",
        actorId: "system",
        payload: discrepancy,
        at: Date.now()
      });
    }
  }

  return { checked: walletsSnap.size, discrepancies };
}
