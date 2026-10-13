import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getCustomerCreditSummary } from "@/lib/customerCredits";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    let customerId = searchParams.get("customerId");

    // Also support Bearer token if query param is not supplied
    if (!customerId) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const idToken = authHeader.split("Bearer ")[1];
          const decoded = await adminAuth.verifyIdToken(idToken);
          customerId = decoded.uid;
        } catch {
          // Token invalid, customerId remains undefined
        }
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: "Missing customerId parameter or valid auth token" }, { status: 400 });
    }

    const summary = await getCustomerCreditSummary(customerId);

    return NextResponse.json({
      success: true,
      availableBalanceKobo: summary.availableBalanceKobo,
      availableBalanceNaira: Math.round(summary.availableBalanceKobo / 100),
      lifetimeEarnedKobo: summary.lifetimeEarnedKobo,
      lifetimeEarnedNaira: Math.round(summary.lifetimeEarnedKobo / 100),
      availableCredits: summary.availableCredits,
      usedCredits: summary.usedCredits
    });
  } catch (error: any) {
    console.error("Failed to fetch customer credits:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
