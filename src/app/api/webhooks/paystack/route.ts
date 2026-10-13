import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentProvider } from "@/lib/paystack";
import { writeJobEvent } from "@/lib/jobEvents";
import { JobRequestData } from "@/types/platform";
import { getConfig } from "@/lib/platformConfig";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Only process charge.success
    if (event.event === "charge.success") {
      const { reference, amount, metadata, customer: { email } } = event.data;

      // Ensure idempotency
      const eventRef = adminDb.collection("paystackEvents").doc(reference);
      const eventSnap = await eventRef.get();
      if (eventSnap.exists) {
        return NextResponse.json({ success: true, message: "Already processed" });
      }
      
      // Verify via API just to be extra sure (standard Paystack practice)
      const verification = await paymentProvider.verifyTransaction(reference);
      if (verification.status !== "success" || verification.amount !== amount) {
         throw new Error("Transaction verification failed or amount mismatch");
      }

      await eventRef.set({
        processedAt: Date.now(),
        type: metadata?.type || "unknown",
        amount,
        reference
      });

      // Handle deposit
      if (metadata?.type === "deposit") {
        const jobId = metadata.jobId;
        const customerId = metadata.customerId;

        if (jobId) {
          await adminDb.runTransaction(async (tx) => {
            const jobRef = adminDb.collection("jobRequests").doc(jobId);
            const jobSnap = await tx.get(jobRef);
            if (!jobSnap.exists) return;

            const job = jobSnap.data() as JobRequestData;
            
            if (job.state !== "awaiting_deposit") {
               return; // Skip if already processed or cancelled
            }

            const creditRef = adminDb.collection("customerCredits").doc(`credit_pay_${jobId}`);
            const creditSnap = await tx.get(creditRef);

            const creditDiscount = Number(metadata?.creditDiscount || job.creditDiscountApplied || 0);
            const totalDepositPaid = amount + creditDiscount;

            // Mark deposit as paid and transition to confirmed
            tx.update(jobRef, {
              status: "accepted", // Fallback for old UI
              state: "confirmed",
              stateUpdatedAt: Date.now(),
              depositPaid: totalDepositPaid,
              depositStatus: "held", // We hold it in escrow
            });

            // Award in-app payment loyalty credit to customer
            const effectiveCustomerId = customerId || job.customerId;
            if (!creditSnap.exists && effectiveCustomerId) {
              const config = await getConfig();
              const bonus = config.rewards?.inAppPaymentCredit ?? 30000;
              if (bonus > 0) {
                tx.set(creditRef, {
                  creditId: creditRef.id,
                  customerId: effectiveCustomerId,
                  amount: bonus,
                  reason: "in_app_payment_bonus",
                  jobId,
                  used: false,
                  createdAt: Date.now()
                });
              }
            }

            // Log event
            await writeJobEvent(
              jobId,
              "deposit_paid",
              "system",
              { amount, creditDiscount, totalDepositPaid, reference },
              tx
            );
            
            await writeJobEvent(
              jobId,
              "state_change",
              "system",
              { from: "awaiting_deposit", to: "confirmed", guard: "depositPaidOrNotRequired" },
              tx
            );
          });

          // After transaction, send push notification to artisan
          const jobSnap = await adminDb.collection("jobRequests").doc(jobId).get();
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
                  data: { jobId, type: "job_confirmed" }
                })
             }).catch(console.error);
          }
        }
      }

      // Handle wallet top-up
      if (metadata?.type === "wallet_topup") {
        const userId = metadata.userId;
        const channel = event.data?.channel || verification.providerRaw?.channel || "card";
        if (userId) {
          const { postLedgerEntry } = await import("@/lib/ledger");
          await adminDb.runTransaction(async (tx) => {
            await postLedgerEntry(tx, {
              userId,
              jobId: null,
              type: "topup",
              amount,
              reference: `topup_${reference}`,
              channel
            });
          });
        }
      }
    }

    // Handle transfer events
    if (event.event.startsWith("transfer.")) {
      const { transfer_code, reference, status, amount } = event.data;

      // Extract original payout doc id if we stored it (or query by reference)
      const eventRef = adminDb.collection("paystackEvents").doc(reference + "_" + event.event);
      const eventSnap = await eventRef.get();
      if (eventSnap.exists) {
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      await eventRef.set({
        processedAt: Date.now(),
        type: event.event,
        reference,
        status
      });

      // Find the payout
      const payoutsQuery = await adminDb.collection("payouts").where("reference", "==", reference).limit(1).get();
      if (!payoutsQuery.empty) {
        const payoutDoc = payoutsQuery.docs[0];
        const payout = payoutDoc.data();
        
        await adminDb.runTransaction(async (tx) => {
          if (event.event === "transfer.success") {
            tx.update(payoutDoc.ref, { status: "success" });
          } else if (event.event === "transfer.failed" || event.event === "transfer.reversed") {
            // Reverse the ledger entry
            const { postLedgerEntry } = await import("@/lib/ledger");
            await postLedgerEntry(tx, {
              userId: payout.userId,
              jobId: null,
              type: "withdrawal_reversal",
              amount: payout.amount,
              reference: `${reference}_${event.event}`
            });
            
            tx.update(payoutDoc.ref, { status: event.event === "transfer.failed" ? "failed" : "reversed" });
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Paystack Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
