import { NextRequest, NextResponse } from "next/server";
import { submitStrikeAppeal } from "@/lib/strikes";
import { verifyUserRequest } from "@/lib/userAuthGuard";

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const body = await req.json();
    const { strikeId, appealNote, appealEvidencePhotos } = body;
    const userId = authCheck.user.uid;

    if (!strikeId || !appealNote?.trim()) {
      return NextResponse.json(
        { error: "strikeId and appealNote are required" },
        { status: 400 }
      );
    }

    await submitStrikeAppeal({
      strikeId,
      userId,
      appealNote: appealNote.trim(),
      appealEvidencePhotos: Array.isArray(appealEvidencePhotos) ? appealEvidencePhotos : []
    });

    return NextResponse.json({
      success: true,
      message: "Appeal submitted successfully. Our team will review your explanation and evidence."
    });
  } catch (error: any) {
    console.error("Submit strike appeal error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit appeal" }, { status: 500 });
  }
}
