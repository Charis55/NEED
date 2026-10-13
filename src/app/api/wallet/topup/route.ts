import { NextRequest, NextResponse } from "next/server";
import { paymentProvider } from "@/lib/paystack";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount } = body; // amount in kobo

    if (!userId || !amount || amount < 10000) { // Min N100
      return NextResponse.json({ error: "Invalid topup parameters (minimum ₦100)" }, { status: 400 });
    }

    const userSnap = await adminDb.collection("users").doc(userId).get();
    const email = userSnap.data()?.email || `${userId}@user.need.ng`;

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
    });

  } catch (error: any) {
    console.error("Wallet topup init error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
