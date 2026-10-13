import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { writeJobEvent } from "@/lib/jobEvents";
import { GuaranteeClaim, JobRequestData, Wallet } from "@/types/platform";
import { resolveGuaranteeClaimPure, GuaranteeResolutionAction } from "@/lib/guarantee";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      claimId,
      adminId,
      resolution,
      notes,
      clawbackAmountKobo
    } = body as {
      claimId: string;
      adminId: string;
      resolution: GuaranteeResolutionAction;
      notes: string;
      clawbackAmountKobo?: number;
    };

    if (!claimId || !adminId || !resolution || !notes) {
      return NextResponse.json(
        { error: "claimId, adminId, resolution, and notes are required" },
        { status: 400 }
      );
    }

    if (!["redo_arranged", "refunded_clawback", "rejected"].includes(resolution)) {
      return NextResponse.json(
        { error: "Invalid resolution action. Must be 'redo_arranged', 'refunded_clawback', or 'rejected'" },
        { status: 400 }
      );
    }

    return await adminDb.runTransaction(async (tx) => {
      const claimRef = adminDb.collection("guaranteeClaims").doc(claimId);
      const claimSnap = await tx.get(claimRef);
      if (!claimSnap.exists) {
        throw new Error("Guarantee claim not found");
      }
      const claim = claimSnap.data() as GuaranteeClaim;

      const jobRef = adminDb.collection("jobRequests").doc(claim.jobId);
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) {
        throw new Error("Associated job not found");
      }
      const job = jobSnap.data() as JobRequestData;

      let artisanWalletBalance = 0;
      const walletRef = adminDb.collection("wallets").doc(claim.artisanId);
      const walletSnap = await tx.get(walletRef);
      if (walletSnap.exists) {
        const wallet = walletSnap.data() as Wallet;
        artisanWalletBalance = wallet.balance || 0;
      }

      const result = resolveGuaranteeClaimPure({
        claim,
        job,
        adminId,
        resolution,
        notes,
        clawbackAmountKobo,
        artisanWalletBalance
      });

      // 1. Update claim document
      tx.update(claimRef, result.claimUpdates);

      // 2. Update job document
      tx.update(jobRef, result.jobUpdates);

      // 3. If refund/clawback was selected, handle wallet debit and customer credit
      if (result.walletUpdate) {
        if (walletSnap.exists) {
          tx.update(walletRef, {
            balance: result.walletUpdate.newBalance,
            updatedAt: Date.now()
          });
        } else {
          tx.set(walletRef, {
            userId: claim.artisanId,
            balance: result.walletUpdate.newBalance,
            pendingEarnings: 0,
            creditLimit: 500000,
            blockedReason: result.walletUpdate.newBalance < -500000 ? "negative_balance" : "none",
            updatedAt: Date.now()
          });
        }

        const txRef = adminDb.collection("walletTransactions").doc();
        tx.set(txRef, {
          txId: txRef.id,
          userId: claim.artisanId,
          jobId: claim.jobId,
          type: result.walletUpdate.txType,
          amount: result.walletUpdate.clawbackAmount,
          balanceAfter: result.walletUpdate.newBalance,
          reference: result.walletUpdate.reference,
          createdAt: Date.now()
        });
      }

      if (result.customerCredit) {
        const creditRef = adminDb.collection("customerCredits").doc(`credit_guarantee_${claimId}`);
        tx.set(creditRef, {
          creditId: creditRef.id,
          customerId: claim.customerId,
          amount: result.customerCredit.amount,
          reason: result.customerCredit.reason,
          jobId: result.customerCredit.jobId,
          used: false,
          createdAt: Date.now()
        });
      }

      // 4. Record job event
      await writeJobEvent(
        claim.jobId,
        "guarantee_claim_resolved",
        adminId,
        result.eventPayload,
        tx
      );

      return NextResponse.json({
        success: true,
        resolution: result.newClaimStatus,
        newJobState: result.newJobState,
        message: `Guarantee claim ${claimId} resolved with action '${resolution}'.`
      });
    });
  } catch (error: any) {
    console.error("Resolve guarantee claim error:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve claim" }, { status: 500 });
  }
}
