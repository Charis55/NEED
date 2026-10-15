import { NextRequest, NextResponse } from "next/server";
import { paymentProvider } from "@/lib/paystack";
import { adminDb } from "@/lib/firebaseAdmin";

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
    const body = await req.json();
    const { userId, amount, email: clientEmail } = body; // amount in kobo

    if (!userId || !amount || amount < 10000) { // Min N100
      return NextResponse.json(
        { error: "Invalid topup parameters (minimum ₦100)" },
        { status: 400, headers: corsHeaders }
      );
    }

    let email = clientEmail;
    if (!email) {
      try {
        const userSnap = await adminDb.collection("users").doc(userId).get();
        email = userSnap.data()?.email;
      } catch (err) {
        console.warn("Could not fetch user email from adminDb:", err);
      }
    }

    if (!email) {
      email = `${userId}@user.need.ng`;
    }

    const reference = `topup_${userId}_${Date.now()}`;

    const tx = await paymentProvider.initializeTransaction({
      amount,
      email,
      reference,
      metadata: {
        type: "wallet_topup",
        userId
      }
    });

    return NextResponse.json({
      success: true,
      authorizationUrl: tx.authorizationUrl,
      reference
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("Wallet topup init error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize topup" },
      { status: 500, headers: corsHeaders }
    );
  }
}
