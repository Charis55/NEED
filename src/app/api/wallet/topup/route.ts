import { NextRequest, NextResponse } from "next/server";
import { paymentProvider } from "@/lib/paystack";
import { verifyUserRequest } from "@/lib/userAuthGuard";

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
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const body = await req.json();
    const { amount, email: clientEmail, source, callbackUrl: clientCallbackUrl } = body; // amount in kobo
    const userId = authCheck.user.uid;

    if (!amount || amount < 10000) { // Min N100
      return NextResponse.json(
        { error: "Invalid topup parameters (minimum ₦100)" },
        { status: 400, headers: corsHeaders }
      );
    }

    let email = clientEmail || authCheck.user.email;
    if (!email) {
      try {
        const { adminDb } = await import("@/lib/firebaseAdmin");
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
      callbackUrl: clientCallbackUrl,
      metadata: {
        type: "wallet_topup",
        userId,
        source: source === "app" ? "app" : "web"
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
