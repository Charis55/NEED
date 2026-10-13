import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentProvider } from "@/lib/paystack";
import { postLedgerEntry } from "@/lib/ledger";
import { Payout, UserPrivate, Wallet } from "@/types/platform";

export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = await req.json();

    if (!userId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // Load bank account
    const userPrivateSnap = await adminDb.collection("userPrivate").doc(userId).get();
    if (!userPrivateSnap.exists) {
      return NextResponse.json({ error: "User details not found" }, { status: 404 });
    }
    const userPrivate = userPrivateSnap.data() as UserPrivate;
    
    if (!userPrivate.bankAccount?.recipientCode) {
      return NextResponse.json({ error: "No verified bank account found" }, { status: 400 });
    }

    // Check withdrawal limit: max 4 withdrawals in the last 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentWithdrawalsSnap = await adminDb
      .collection("payouts")
      .where("userId", "==", userId)
      .get();
      
    // Count successful or pending withdrawals in the last 7 days
    let activeWithdrawals = 0;
    recentWithdrawalsSnap.forEach((doc) => {
      const p = doc.data() as Payout;
      if (p.createdAt >= oneWeekAgo && (p.status === "success" || p.status === "pending")) {
        activeWithdrawals++;
      }
    });

    if (activeWithdrawals >= 4) {
      return NextResponse.json({ error: "You have reached your weekly limit of 4 withdrawals to minimize charges. Please try again next week." }, { status: 403 });
    }

    const reference = `with_${userId}_${Date.now()}`;

    // 1. Transaction to reserve funds and log intent
    const { newPayout } = await adminDb.runTransaction(async (tx) => {
      const walletRef = adminDb.collection("wallets").doc(userId);
      const walletSnap = await tx.get(walletRef);
      if (!walletSnap.exists) {
        throw new Error("Wallet not found");
      }
      
      const wallet = walletSnap.data() as Wallet;
      if (wallet.balance < amount) {
        throw new Error("Insufficient funds in wallet");
      }
      
      if (wallet.blockedReason !== "none") {
        throw new Error(`Wallet blocked: ${wallet.blockedReason}`);
      }

      const bankName = userPrivate.bankAccount?.bankName || "Bank";
      const accountNumber = userPrivate.bankAccount?.accountNumber;
      const accountName = userPrivate.bankAccount?.accountName;
      const channelDesc = `Transfer to ${bankName}${accountNumber ? ` (••••${accountNumber.slice(-4)})` : ""}`;

      // Post negative ledger entry
      await postLedgerEntry(tx, {
        userId,
        jobId: null,
        type: "withdrawal",
        amount: -amount,
        reference,
        channel: channelDesc
      });

      const payoutRef = adminDb.collection("payouts").doc();
      const payout: Payout = {
        payoutId: payoutRef.id,
        userId,
        amount,
        reference,
        status: "pending",
        bankName,
        accountNumber,
        accountName,
        createdAt: Date.now()
      };
      
      tx.set(payoutRef, payout);
      
      return { newPayout: payout };
    });

    // 2. Outside transaction: Initiate Paystack transfer
    try {
      const transferData = await paymentProvider.initiateTransfer({
        amount,
        recipientCode: userPrivate.bankAccount.recipientCode,
        reason: "NEED Artisan Withdrawal",
        reference,
      });

      // Update payout with transfer code
      await adminDb.collection("payouts").doc(newPayout.payoutId).update({
        transferCode: transferData.transferCode,
        // Status remains pending until webhook confirms, or can be mapped if immediate success
      });

      return NextResponse.json({ success: true, payout: { ...newPayout, transferCode: transferData.transferCode } });
      
    } catch (transferError: any) {
      // 3. Reversal if API call failed instantly
      console.error("Paystack transfer failed instantly:", transferError);
      
      await adminDb.runTransaction(async (tx) => {
        // Post positive ledger entry to refund
        await postLedgerEntry(tx, {
          userId,
          jobId: null,
          type: "withdrawal_reversal",
          amount: amount, // Positive refund
          reference: `${reference}_rev`
        });
        
        tx.update(adminDb.collection("payouts").doc(newPayout.payoutId), {
          status: "failed"
        });
      });
      
      return NextResponse.json({ error: "Transfer failed: " + transferError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error("withdraw error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
