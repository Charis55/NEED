import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { paymentProvider } from "@/lib/paystack";
import { computeRequiredDeposit, computeFee } from "@/lib/feeEngine";
import { defaultPlatformConfig } from "@/lib/platformConfig";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      customerId, artisanId, offerAmount, trade, subcategory, services, 
      description, neighborhood, locationCoords, preferredTime, mediaUrl,
      jobId 
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

    // Convert offer to kobo (assuming offerAmount is in Naira initially if it came from old frontend, but let's assume it's in Naira string/number and we multiply by 100)
    // Actually, looking at request/page.tsx, offerAmount is parsed as integer. That is in Naira.
    const priceInKobo = Math.round(Number(offerAmount) * 100);

    // Compute fee preview and required deposit
    // Default pairJobNumber to 1 for now (ideally we should query how many jobs they've done together)
    const { fee } = computeFee(priceInKobo, 1, defaultPlatformConfig);
    const depositRequired = computeRequiredDeposit(priceInKobo, fee, defaultPlatformConfig);

    let finalJobId = jobId;

    // If no existing jobId is provided (direct booking), create a draft jobRequest in awaiting_deposit state
    if (!finalJobId) {
      const jobRef = adminDb.collection("jobRequests").doc();
      finalJobId = jobRef.id;

      await jobRef.set({
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

        state: "awaiting_deposit",
        stateUpdatedAt: Date.now(),
        agreedPrice: priceInKobo,
        finalPrice: null,
        paymentMode: "deposit_plus_cash",
        depositRequired,
        depositPaid: 0,
        depositStatus: "pending",
        platformFee: fee,
        feeConfigVersion: defaultPlatformConfig.version,
        feeRatePercentApplied: defaultPlatformConfig.feeTiers[0].ratePercent,
        pairJobNumber: 1,
        commissionSettled: false,
        bookedViaPlatform: true,

        createdAt: Date.now()
      });
    } else {
      // If jobId is provided, it's an existing broadcast job where the customer accepted a bid
      // We should update the job to "awaiting_deposit" and set the agreedPrice
      await adminDb.collection("jobRequests").doc(finalJobId).update({
        state: "awaiting_deposit",
        stateUpdatedAt: Date.now(),
        agreedPrice: priceInKobo,
        depositRequired,
        platformFee: fee,
        feeConfigVersion: defaultPlatformConfig.version,
        depositStatus: "pending"
      });
    }

    // Initialize Paystack checkout
    const reference = `dep_${finalJobId}_${Date.now()}`;
    const tx = await paymentProvider.initializeTransaction({
      amount: depositRequired,
      email,
      reference,
      metadata: {
        type: "deposit",
        jobId: finalJobId,
        customerId
      }
    });

    return NextResponse.json({ 
      success: true, 
      authorizationUrl: tx.authorizationUrl,
      jobId: finalJobId,
      depositRequired
    });

  } catch (error: any) {
    console.error("Checkout initialize error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
