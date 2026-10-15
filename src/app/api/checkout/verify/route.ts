import { NextRequest, NextResponse } from "next/server";
import { paymentProvider } from "@/lib/paystack";
import { JobRequestData } from "@/types/platform";

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
    const { reference, jobId, type: requestedType } = await req.json();

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400, headers: corsHeaders });
    }

    // Verify transaction with Paystack
    const verification = await paymentProvider.verifyTransaction(reference);
    
    if (verification.status !== "success") {
      return NextResponse.json({ success: false, message: "Transaction not successful yet" }, { headers: corsHeaders });
    }

    const { adminDb } = await import("@/lib/firebaseAdmin");

    const amount = verification.amount;
    const metadata = verification.providerRaw?.metadata || {};
    const detectedType = 
      requestedType || 
      metadata.type || 
      (reference.startsWith("topup_") ? "wallet_topup" : reference.startsWith("with_") ? "withdrawal" : "deposit");

    // Check if already processed
    const eventRef = adminDb.collection("paystackEvents").doc(reference);
    const eventSnap = await eventRef.get();
    
    if (eventSnap.exists) {
      return NextResponse.json({ 
        success: true, 
        alreadyProcessed: true,
        type: detectedType,
        amount,
        jobId: jobId || metadata.jobId
      }, { headers: corsHeaders });
    }

    // 1. Handle Wallet Top-up
    if (detectedType === "wallet_topup") {
      const userId = metadata.userId || (reference.startsWith("topup_") ? reference.split("_")[1] : null);
      if (!userId) {
        return NextResponse.json({ error: "Cannot identify user for wallet topup" }, { status: 400, headers: corsHeaders });
      }

      const channel = verification.providerRaw?.channel || "card";

      await eventRef.set({
        processedAt: Date.now(),
        type: "wallet_topup",
        amount,
        reference,
        channel,
        userId,
        source: "client_verify"
      });

      const { postLedgerEntry } = await import("@/lib/ledger");
      await adminDb.runTransaction(async (tx) => {
        await postLedgerEntry(tx, {
          userId,
          jobId: null,
          type: "topup",
          amount,
          reference: reference.startsWith("topup_") ? reference : `topup_${reference}`,
          channel
        });
      });

      return NextResponse.json({ 
        success: true, 
        type: "wallet_topup", 
        amount, 
        channel,
        userId 
      }, { headers: corsHeaders });
    }

    // 2. Handle Job Deposit
    const targetJobId = jobId || metadata.jobId;
    if (targetJobId) {
      await eventRef.set({
        processedAt: Date.now(),
        type: "deposit",
        amount,
        reference,
        source: "client_verify"
      });

      const { writeJobEvent } = await import("@/lib/jobEvents");
      const { getConfig } = await import("@/lib/platformConfig");

      await adminDb.runTransaction(async (tx) => {
        const jobRef = adminDb.collection("jobRequests").doc(targetJobId);
        const jobSnap = await tx.get(jobRef);
        if (!jobSnap.exists) return;

        const job = jobSnap.data() as JobRequestData;
        
        if (job.depositStatus === "held" && job.depositPaid && job.depositPaid > 0) {
           return; // Skip if already processed
        }

        const creditRef = adminDb.collection("customerCredits").doc(`credit_pay_${targetJobId}`);
        const creditSnap = await tx.get(creditRef);

        const creditDiscount = Number(metadata.creditDiscount || job.creditDiscountApplied || 0);
        const totalDepositPaid = amount + creditDiscount;

        // Mark deposit as paid and transition to confirmed
        tx.update(jobRef, {
          status: "accepted", // Fallback for old UI
          state: "confirmed",
          stateUpdatedAt: Date.now(),
          depositPaid: totalDepositPaid,
          depositStatus: "held", 
        });

        // Award in-app payment loyalty credit to customer
        if (!creditSnap.exists && job.customerId) {
          const config = await getConfig();
          const bonus = config.rewards?.inAppPaymentCredit ?? 30000;
          if (bonus > 0) {
            tx.set(creditRef, {
              creditId: creditRef.id,
              customerId: job.customerId,
              amount: bonus,
              reason: "in_app_payment_bonus",
              jobId: targetJobId,
              used: false,
              createdAt: Date.now()
            });
          }
        }

        // Log event
        await writeJobEvent(
          targetJobId,
          "deposit_paid",
          "system",
          { amount, creditDiscount, totalDepositPaid, reference },
          tx
        );
        
        await writeJobEvent(
          targetJobId,
          "state_change",
          "system",
          { from: "awaiting_deposit", to: "confirmed", guard: "depositPaidOrNotRequired" },
          tx
        );
      });

      // Send push notification to artisan
      const jobSnap = await adminDb.collection("jobRequests").doc(targetJobId).get();
      const jobData = jobSnap.data();
      if (jobData && jobData.artisanId) {
         const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
         fetch(`${baseUrl}/api/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: jobData.artisanId,
              title: "Job Confirmed!",
              body: "The customer has paid the deposit. Tap to view the job.",
              data: { jobId: targetJobId, type: "job_confirmed" }
            })
         }).catch(console.error);
      }

      return NextResponse.json({ success: true, type: "deposit", jobId: targetJobId, amount }, { headers: corsHeaders });
    }

    return NextResponse.json({ success: true, type: detectedType, amount }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Checkout verify error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
