import { NextRequest, NextResponse } from "next/server";
import { verifyUserRequest } from "@/lib/userAuthGuard";
import { getCustomerCreditSummary } from "@/lib/customerCredits";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const searchParams = req.nextUrl.searchParams;
    const requestedCustomerId = searchParams.get("customerId");

    const isAdmin = authCheck.user.email === "obunezicharis@gmail.com";
    const customerId = (isAdmin && requestedCustomerId) ? requestedCustomerId : authCheck.user.uid;

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
