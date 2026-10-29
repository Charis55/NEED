import { NextRequest, NextResponse } from "next/server";
import { reviewStrikeAppeal } from "@/lib/strikes";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyAdminRequest(req);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await req.json();
    const { strikeId, decision, resolutionNote } = body;
    const adminId = authCheck.admin.email || authCheck.admin.uid;

    if (!strikeId || !decision) {
      return NextResponse.json(
        { error: "strikeId and decision ('approved' | 'rejected') are required" },
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
