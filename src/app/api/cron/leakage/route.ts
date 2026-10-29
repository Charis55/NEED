import { NextRequest, NextResponse } from "next/server";
import { expireUnpaidDeposits, autoConfirmCompletions, reconcileLedger } from "@/lib/settlement";
import { runNightlyLeakageDetection } from "@/lib/leakage";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    const isCronAuthorized = Boolean(secret && authHeader === `Bearer ${secret}`);

    if (!isCronAuthorized) {
      const adminCheck = await verifyAdminRequest(req);
      if (adminCheck.errorResponse) {
        return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
      }
    }

    const { task = "all" } = await req.json().catch(() => ({ task: "all" }));

    const results: Record<string, any> = {};

    if (task === "all" || task === "expire_deposits") {
      results.expiredDeposits = await expireUnpaidDeposits();
    }

    if (task === "all" || task === "auto_confirm") {
      results.autoConfirmed = await autoConfirmCompletions();
    }

    if (task === "all" || task === "leakage_detection") {
      results.leakageDetection = await runNightlyLeakageDetection();
    }

    if (task === "all" || task === "reconcile") {
      results.reconciliation = await reconcileLedger();
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      results
    });
  } catch (error: any) {
    console.error("Cron leakage maintenance error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
