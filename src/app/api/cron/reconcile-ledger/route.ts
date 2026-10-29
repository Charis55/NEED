import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentProvider } from "@/lib/paystack";
import { runReconciliationAudit } from "@/lib/reconciliation";
import { Wallet, WalletTransaction, JobRequestData } from "@/types/platform";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";

export async function GET(req: NextRequest) {
  return handleReconciliation(req);
}

export async function POST(req: NextRequest) {
  return handleReconciliation(req);
}

async function handleReconciliation(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, enforce token authorization or admin authentication
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const adminCheck = await verifyAdminRequest(req);
      if (adminCheck.errorResponse) {
        return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
      }
    }

    const now = Date.now();

    // 1. Fetch all wallets
    const walletsSnap = await adminDb.collection("wallets").get();
    const wallets: Wallet[] = walletsSnap.docs.map((doc) => doc.data() as Wallet);

    // 2. Fetch all wallet transactions and group by userId
    const txSnap = await adminDb.collection("walletTransactions").get();
    const transactionsByUser: Record<string, WalletTransaction[]> = {};

    for (const doc of txSnap.docs) {
      const tx = doc.data() as WalletTransaction;
      if (!transactionsByUser[tx.userId]) {
        transactionsByUser[tx.userId] = [];
      }
      transactionsByUser[tx.userId].push(tx);
    }

    // 3. Fetch all active jobs with held escrow deposits
    const heldJobsSnap = await adminDb
      .collection("jobRequests")
      .where("depositStatus", "in", ["held", "under_review"])
      .get();

    const heldEscrowJobs = heldJobsSnap.docs.map((doc) => {
      const data = doc.data() as JobRequestData;
      return {
        requestId: doc.id,
        depositPaid: data.depositPaid || 0,
      };
    });

    // 4. Fetch live settlement balance from Paystack
    let paystackBalanceKobo: number | null = null;
    try {
      const paystackData = await paymentProvider.fetchBalance();
      if (paystackData) {
        paystackBalanceKobo = paystackData.balance;
      }
    } catch (paystackErr) {
      console.warn("Unable to fetch Paystack balance during reconciliation:", paystackErr);
    }

    // 5. Execute reconciliation audit
    const { report, newDiscrepancies } = runReconciliationAudit({
      wallets,
      transactionsByUser,
      heldEscrowJobs,
      paystackBalanceKobo,
      now,
    });

    // 6. Record discrepancies in Firestore
    const batch = adminDb.batch();

    for (const disc of newDiscrepancies) {
      const discRef = adminDb.collection("adminDiscrepancies").doc(disc.discrepancyId);
      batch.set(discRef, disc);
    }

    // Record reconciliation run report
    const reportRef = adminDb.collection("reconciliationReports").doc(report.reportId);
    batch.set(reportRef, report);

    await batch.commit();

    return NextResponse.json({
      success: true,
      report,
      discrepanciesCount: newDiscrepancies.length,
      newDiscrepancies,
    });
  } catch (error: any) {
    console.error("Reconciliation execution error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute ledger reconciliation" },
      { status: 500 }
    );
  }
}
