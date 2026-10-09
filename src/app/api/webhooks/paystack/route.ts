import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentProvider } from "@/lib/paystack";
import { writeJobEvent } from "@/lib/jobEvents";
import { JobRequestData } from "@/types/platform";

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

            // Mark deposit as paid and transition to confirmed
            tx.update(jobRef, {
              state: "confirmed",
              stateUpdatedAt: Date.now(),
              depositPaid: amount,
              depositStatus: "held", // We hold it in escrow
            });

            // Log event
            await writeJobEvent(
              jobId,
              "deposit_paid",
              "system",
              { amount, reference },
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
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Paystack Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
