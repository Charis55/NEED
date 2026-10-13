import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentProvider } from "@/lib/paystack";
import { computeRequiredDeposit, computeFee } from "@/lib/feeEngine";
import { getConfig } from "@/lib/platformConfig";
import { writeJobEvent } from "@/lib/jobEvents";
import { CustomerCredit } from "@/types/platform";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      customerId, artisanId, offerAmount, trade, subcategory, services, 
      description, neighborhood, locationCoords, preferredTime, mediaUrl,
      jobId, applyCredits = false
    } = body;

    if (!customerId || !offerAmount || (!artisanId && !jobId)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get user email for paystack
    const customerSnap = await adminDb.collection("users").doc(customerId).get();
    if (!customerSnap.exists) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const customer = customerSnap.data();
    const email = customer?.email || "customer@need.app";

    const config = await getConfig();

    // Convert offer to kobo
    const priceInKobo = Math.round(Number(offerAmount) * 100);

    // Look up repeat customer pair history to apply loyalty fee tiers (15% -> 10% -> 6%)
    const effectiveArtisanId = artisanId || (jobId ? (await adminDb.collection("jobRequests").doc(jobId).get()).data()?.artisanId : null);
    let completedPairCount = 0;
    if (customerId && effectiveArtisanId) {
      const pairId = `${customerId}_${effectiveArtisanId}`;
      const pairSnap = await adminDb.collection("pairs").doc(pairId).get();
      if (pairSnap.exists) {
        completedPairCount = pairSnap.data()?.completedCount || 0;
      }
    }
    const pairJobNumber = completedPairCount + 1;

    // Compute fee preview and required deposit
    const { fee, ratePercent } = computeFee(priceInKobo, pairJobNumber, config);
    const depositRequired = computeRequiredDeposit(priceInKobo, fee, config);

    // Check available customer loyalty credits if applyCredits requested
    let totalAvailableCreditKobo = 0;
    if (applyCredits) {
      const creditsSnap = await adminDb
        .collection("customerCredits")
        .where("customerId", "==", customerId)
        .where("used", "==", false)
        .get();

      creditsSnap.forEach((doc) => {
        const credit = doc.data() as CustomerCredit;
        totalAvailableCreditKobo += Number(credit.amount || 0);
      });
    }

    const creditDiscount = applyCredits ? Math.min(depositRequired, totalAvailableCreditKobo) : 0;
    const amountToPay = depositRequired - creditDiscount;

    let finalJobId = jobId;
    if (!finalJobId) {
      const jobRef = adminDb.collection("jobRequests").doc();
      finalJobId = jobRef.id;
    }

    // If remaining amount to pay > 0, initialize Paystack first before altering DB
    let paystackTx: { authorizationUrl: string } | null = null;
    if (amountToPay > 0) {
      const reference = `dep_${finalJobId}_${Date.now()}`;
      paystackTx = await paymentProvider.initializeTransaction({
        amount: amountToPay,
        email,
        reference,
        metadata: {
          type: "deposit",
          jobId: finalJobId,
          customerId,
          creditDiscount
        }
      });
    }

    // Atomically persist job request and lock/consume applied credits
    await adminDb.runTransaction(async (transaction) => {
      const jobRef = adminDb.collection("jobRequests").doc(finalJobId);
      const existingJobSnap = await transaction.get(jobRef);

      const usedCreditIds: string[] = [];

      // Read and consume credits if discount was applied
      if (creditDiscount > 0) {
        const creditsQuerySnap = await transaction.get(
          adminDb
            .collection("customerCredits")
            .where("customerId", "==", customerId)
            .where("used", "==", false)
        );

        const creditDocs = creditsQuerySnap.docs.map((d) => ({
          ref: d.ref,
          data: d.data() as CustomerCredit
        }));
        creditDocs.sort((a, b) => a.data.createdAt - b.data.createdAt);

        let remainingNeeded = creditDiscount;
        for (const { ref, data } of creditDocs) {
          if (remainingNeeded <= 0) break;
          const amt = Number(data.amount || 0);
          if (amt <= 0) continue;

          if (amt <= remainingNeeded) {
            transaction.update(ref, {
              used: true,
              usedJobId: finalJobId,
              usedAt: Date.now()
            });
            usedCreditIds.push(data.creditId);
            remainingNeeded -= amt;
          } else {
            const usedPart = remainingNeeded;
            const leftoverPart = amt - remainingNeeded;

            transaction.update(ref, {
              amount: usedPart,
              used: true,
              usedJobId: finalJobId,
              usedAt: Date.now()
            });
            usedCreditIds.push(data.creditId);

            const leftoverRef = adminDb.collection("customerCredits").doc();
            transaction.set(leftoverRef, {
              creditId: leftoverRef.id,
              customerId,
              amount: leftoverPart,
              reason: data.reason,
              jobId: data.jobId || null,
              surveyId: data.surveyId || null,
              used: false,
              createdAt: data.createdAt
            });
            remainingNeeded = 0;
            break;
          }
        }
      }

      const isFullyCovered = amountToPay === 0;

      if (!existingJobSnap.exists) {
        transaction.set(jobRef, {
          requestId: finalJobId,
          customerId,
          artisanId,
          trade,
          subcategory,
          services: services || [],
          description,
          neighborhood,
          locationCoords,
          preferredTime,
          mediaUrl: mediaUrl || null,
          offerAmount: Number(offerAmount),

          status: isFullyCovered ? "accepted" : "pending",
          state: isFullyCovered ? "confirmed" : "awaiting_deposit",
          stateUpdatedAt: Date.now(),
          agreedPrice: priceInKobo,
          finalPrice: null,
          paymentMode: "deposit_plus_cash",
          depositRequired,
          depositPaid: isFullyCovered ? depositRequired : 0,
          creditDiscountApplied: creditDiscount,
          creditsUsed: usedCreditIds,
          depositStatus: isFullyCovered ? "held" : "pending",
          platformFee: fee,
          feeConfigVersion: config.version,
          feeRatePercentApplied: ratePercent,
          pairJobNumber,
          commissionSettled: false,
          bookedViaPlatform: true,

          createdAt: Date.now()
        });
      } else {
        const existingData = existingJobSnap.data();
        const isAlreadyAccepted = existingData?.status === "accepted";
        const nextStatus = isAlreadyAccepted ? "accepted" : (isFullyCovered ? "accepted" : (existingData?.status || "pending"));
        const nextState = isFullyCovered ? "confirmed" : (isAlreadyAccepted ? "awaiting_deposit" : (existingData?.state || "awaiting_deposit"));

        transaction.update(jobRef, {
          offerAmount: Number(offerAmount),
          status: nextStatus,
          state: nextState,
          stateUpdatedAt: Date.now(),
          agreedPrice: priceInKobo,
          depositRequired,
          depositPaid: isFullyCovered ? depositRequired : (existingData?.depositPaid || 0),
          creditDiscountApplied: creditDiscount,
          creditsUsed: usedCreditIds,
          platformFee: fee,
          feeConfigVersion: config.version,
          feeRatePercentApplied: ratePercent,
          pairJobNumber,
          depositStatus: isFullyCovered ? "held" : "pending"
        });
      }

      if (isFullyCovered) {
        // Award in-app payment loyalty bonus for completing booking via in-app payment
        const creditAwardRef = adminDb.collection("customerCredits").doc(`credit_pay_${finalJobId}`);
        if (config.rewards?.inAppPaymentCredit > 0) {
          transaction.set(creditAwardRef, {
            creditId: creditAwardRef.id,
            customerId,
            amount: config.rewards.inAppPaymentCredit,
            reason: "in_app_payment_bonus",
            jobId: finalJobId,
            used: false,
            createdAt: Date.now()
          });
        }

        await writeJobEvent(
          finalJobId,
          "deposit_paid",
          "system",
          { amount: 0, creditDiscount, fullyCoveredByCredits: true },
          transaction
        );

        await writeJobEvent(
          finalJobId,
          "state_change",
          "system",
          { from: "awaiting_deposit", to: "confirmed", guard: "depositPaidOrNotRequired" },
          transaction
        );
      }
    });

    // Notify artisan if job confirmed without paystack redirect
    if (amountToPay === 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      fetch(`${baseUrl}/api/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: artisanId,
          title: "Job Confirmed!",
          body: "The customer has confirmed the booking. Tap to view the job.",
          data: { jobId: finalJobId, type: "job_confirmed" }
        })
      }).catch(console.error);
    }

    return NextResponse.json({ 
      success: true, 
      authorizationUrl: paystackTx?.authorizationUrl || null,
      jobId: finalJobId,
      depositRequired,
      creditDiscount,
      amountToPay,
      fullyCovered: amountToPay === 0,
      pairJobNumber,
      completedPairCount,
      feeRatePercentApplied: ratePercent
    });

  } catch (error: any) {
    console.error("Checkout initialize error:", error);
    return NextResponse.json({ error: error.message || "Failed to initialize checkout" }, { status: 500 });
  }
}
