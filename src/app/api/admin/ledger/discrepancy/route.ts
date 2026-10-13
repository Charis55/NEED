import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { LedgerDiscrepancy } from "@/types/platform";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { discrepancyId, adminId, status, resolutionNote } = body as {
      discrepancyId: string;
      adminId: string;
      status: "investigating" | "resolved" | "dismissed";
      resolutionNote: string;
    };

    if (!discrepancyId || !adminId || !status || !resolutionNote) {
      return NextResponse.json(
        { error: "discrepancyId, adminId, status, and resolutionNote are required" },
        { status: 400 }
      );
    }

    if (!["investigating", "resolved", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const discRef = adminDb.collection("adminDiscrepancies").doc(discrepancyId);
    const discSnap = await discRef.get();

    if (!discSnap.exists) {
      return NextResponse.json({ error: "Discrepancy not found" }, { status: 404 });
    }

    const updatePayload: Partial<LedgerDiscrepancy> = {
      status,
      resolutionNote,
      resolvedBy: adminId,
      resolvedAt: Date.now(),
    };

    await discRef.update(updatePayload);

    return NextResponse.json({
      success: true,
      message: `Discrepancy updated to ${status}`,
    });
  } catch (error: any) {
    console.error("Discrepancy update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update discrepancy" },
      { status: 500 }
    );
  }
}
