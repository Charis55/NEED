import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getConfig } from "@/lib/platformConfig";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const artisanId = searchParams.get("artisanId");

    if (!customerId || !artisanId) {
      return NextResponse.json({ error: "Missing customerId or artisanId" }, { status: 400 });
    }

    const config = await getConfig();
    const pairId = `${customerId}_${artisanId}`;
    const pairSnap = await adminDb.collection("pairs").doc(pairId).get();

    const completedCount = pairSnap.exists ? (pairSnap.data()?.completedCount || 0) : 0;
    const pairJobNumber = completedCount + 1;

    const tier = config.feeTiers.find(t => pairJobNumber <= t.upToPairJobNumber) || config.feeTiers[0];
    const currentRatePercent = tier.ratePercent;
    const baseRatePercent = config.feeTiers[0]?.ratePercent || 15;
    const savingsPercent = Math.max(0, baseRatePercent - currentRatePercent);

    let tierLabel = "Tier 1: Standard Commission (15%)";
    let nextTierMilestone = "Complete this job to unlock 10% commission on your next booking!";

    if (pairJobNumber === 2) {
      tierLabel = "Tier 2: Repeat Client Discount (10%)";
      nextTierMilestone = "Book 1 more job after this to reach VIP Tier (6% commission)!";
    } else if (pairJobNumber >= 3) {
      tierLabel = "Tier 3: VIP Loyalty Commission (6%)";
      nextTierMilestone = "Maximum platform fee savings unlocked!";
    }

    return NextResponse.json({
      success: true,
      pairId,
      completedCount,
      pairJobNumber,
      currentRatePercent,
      baseRatePercent,
      savingsPercent,
      tierLabel,
      nextTierMilestone,
      isRepeatClient: completedCount > 0
    });
  } catch (error: any) {
    console.error("Failed to fetch pair status:", error);
    return NextResponse.json({ error: error.message || "Failed to load pair status" }, { status: 500 });
  }
}
