import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { applyStrike } from "@/lib/strikes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, action, adminId, note } = body;
    // action: "dismiss" | "warn" | "strike" | "suspend" | "deactivate"

    if (!caseId || !action || !adminId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const caseRef = adminDb.collection("leakageCases").doc(caseId);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const caseData = caseSnap.data()!;
    const artisanId = caseData.artisanId;

    if (action === "dismiss") {
      await caseRef.update({
        status: "dismissed",
        resolvedAt: Date.now(),
        resolvedBy: adminId,
        resolutionNote: note || "Dismissed by admin"
      });

      return NextResponse.json({ success: true, message: "Case dismissed" });
    }

    if (action === "warn" || action === "strike" || action === "suspend" || action === "deactivate") {
      const strikeRes = await applyStrike({
        userId: artisanId,
        reason: note || `Enforcement action taken on leakage case ${caseId}`,
        evidenceSummary: caseData.reasons?.join("; ") || "Circumvention signals detected",
        adminId
      });

      await caseRef.update({
        status: `resolved_${action}` as any,
        resolvedAt: Date.now(),
        resolvedBy: adminId,
        resolutionNote: note || `Action ${action} executed`,
        strikeId: strikeRes.strikeId
      });

      return NextResponse.json({ success: true, ...strikeRes });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (error: any) {
    console.error("Admin case action error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
