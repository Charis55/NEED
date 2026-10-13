import { NextRequest, NextResponse } from "next/server";
import { reviewStrikeAppeal } from "@/lib/strikes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { strikeId, adminId, decision, resolutionNote } = body;

    if (!strikeId || !adminId || !decision) {
      return NextResponse.json(
        { error: "strikeId, adminId, and decision ('approved' | 'rejected') are required" },
        { status: 400 }
      );
    }

    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json(
        { error: "Invalid decision: must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const result = await reviewStrikeAppeal({
      strikeId,
      adminId,
      decision,
      resolutionNote
    });

    return NextResponse.json({
      success: true,
      decision: result.decision,
      activeStrikesRemaining: result.activeStrikesRemaining,
      message:
        decision === "approved"
          ? "Appeal approved. Strike deactivated and account standing restored."
          : "Appeal rejected. Strike remains active on user record."
    });
  } catch (error: any) {
    console.error("Admin review appeal error:", error);
    return NextResponse.json({ error: error.message || "Failed to review appeal" }, { status: 500 });
  }
}
