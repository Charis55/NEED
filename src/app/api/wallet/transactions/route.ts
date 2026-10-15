import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { WalletTransaction, Payout } from "@/types/platform";

export const dynamic = "force-dynamic";

interface TxReturnItem {
  txId: string;
  userId: string;
  jobId: string | null;
  type: string;
  amount: number;
  balanceAfter: number | null;
  reference: string;
  channel: string;
  rawChannel: string | null;
  createdAt: number;
  payoutStatus: "pending" | "success" | "failed" | "reversed" | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400, headers: corsHeaders });
    }

    // 1. Fetch wallet transactions for user
    const txSnap = await adminDb
      .collection("walletTransactions")
      .where("userId", "==", userId)
      .limit(100)
      .get();

    // 2. Fetch payouts for user to cross-reference status and destination bank
    const payoutsSnap = await adminDb
      .collection("payouts")
      .where("userId", "==", userId)
      .limit(50)
      .get();

    const payoutsMap = new Map<string, Payout>();
    payoutsSnap.forEach((doc) => {
      const p = doc.data() as Payout;
      if (p.reference) {
        payoutsMap.set(p.reference, p);
      }
    });

    const transactions: TxReturnItem[] = txSnap.docs.map((doc) => {
      const data = doc.data() as WalletTransaction;
      const payout = data.reference ? payoutsMap.get(data.reference) : null;

      // Normalize channel / medium representation
      let medium = data.channel || "";
      if (!medium) {
        if (data.type === "topup") {
          medium = "Card / Online";
        } else if (data.type === "withdrawal") {
          medium = payout?.bankName ? `Bank Transfer (${payout.bankName})` : "Bank Transfer";
        } else if (data.type === "commission_charge") {
          medium = "Wallet Balance";
        } else if (data.type === "deposit_release_to_artisan") {
          medium = "Escrow Settlement";
        }
      }

      return {
        txId: data.txId || doc.id,
        userId: data.userId,
        jobId: data.jobId || null,
        type: data.type,
        amount: data.amount, // in kobo (+ for credit, - for debit)
        balanceAfter: data.balanceAfter ?? null,
        reference: data.reference,
        channel: medium,
        rawChannel: data.channel || null,
        createdAt: data.createdAt || Date.now(),
        payoutStatus: payout?.status || (data.type === "withdrawal" ? "pending" : null),
        bankName: payout?.bankName || null,
        accountNumber: payout?.accountNumber || null,
        accountName: payout?.accountName || null,
      };
    });

    // Also check if there are any payouts that might not have a ledger tx (fallback)
    const existingRefs = new Set(transactions.map((t) => t.reference));
    payoutsSnap.forEach((doc) => {
      const p = doc.data() as Payout;
      if (p.reference && !existingRefs.has(p.reference)) {
        transactions.push({
          txId: p.payoutId || doc.id,
          userId: p.userId,
          jobId: null,
          type: "withdrawal",
          amount: -p.amount,
          balanceAfter: null,
          reference: p.reference,
          channel: p.bankName ? `Bank Transfer (${p.bankName})` : "Bank Transfer",
          rawChannel: "bank_transfer",
          createdAt: p.createdAt || Date.now(),
          payoutStatus: p.status || "pending",
          bankName: p.bankName || null,
          accountNumber: p.accountNumber || null,
          accountName: p.accountName || null,
        });
      }
    });

    // Sort descending by createdAt
    transactions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({
      success: true,
      transactions,
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Error fetching wallet transactions:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch transactions" },
      { status: 500, headers: corsHeaders }
    );
  }
}
