import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { postLedgerEntry } from "@/lib/ledger";
import { Wallet } from "@/types/platform";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { userId, amount, jobIds = [] } = await req.json();

    if (!userId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid parameters: userId and valid amount required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Convert amount in Naira to Kobo (integer)
    const amountKobo = Math.round(amount * 100);

    const result = await adminDb.runTransaction(async (tx) => {
      // 1. Fetch wallet
      const walletRef = adminDb.collection("wallets").doc(userId);
      const walletSnap = await tx.get(walletRef);
      if (!walletSnap.exists) {
        throw new Error("Wallet not found. Please top up your wallet first.");
      }

      const wallet = walletSnap.data() as Wallet;
      if (wallet.balance < amountKobo) {
        const currentBalNaira = (wallet.balance / 100).toLocaleString("en-NG");
        const requiredNaira = (amountKobo / 100).toLocaleString("en-NG");
        throw new Error(
          `Insufficient wallet balance. You have ₦${currentBalNaira}, but ₦${requiredNaira} is required.`
        );
      }

      const reference = `comm_wallet_${userId}_${Date.now()}`;

      // 2. Post negative ledger entry (deduct commission charge from wallet)
      const ledgerEntry = await postLedgerEntry(tx, {
        userId,
        jobId: null,
        type: "commission_charge",
        amount: -amountKobo,
        reference,
        channel: "Wallet Balance",
      });

      // 3. Mark all targeted jobs as paid/settled
      if (Array.isArray(jobIds) && jobIds.length > 0) {
        for (const jId of jobIds) {
          const jobRef = adminDb.collection("jobRequests").doc(jId);
          tx.update(jobRef, {
            paidToPlatform: true,
            commissionPaid: true,
            commissionSettled: true,
            commissionSettledAt: Date.now(),
            commissionPaymentMethod: "wallet",
            commissionReference: reference,
          });
        }
      }

      // 4. Update blocked status if negative/overdue was resolved
      if (
        (wallet.blockedReason === "negative_balance" ||
          wallet.blockedReason === "overdue_commission") &&
        ledgerEntry.balanceAfter >= 0
      ) {
        tx.update(walletRef, { blockedReason: "none" });
      }

      return {
        success: true,
        reference,
        newBalance: ledgerEntry.balanceAfter,
        amountDeducted: amountKobo,
      };
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Wallet pay-commission error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process commission from wallet" },
      { status: 400, headers: corsHeaders }
    );
  }
}
