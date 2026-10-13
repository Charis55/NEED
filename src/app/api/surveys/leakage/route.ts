import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { resolveAfterArrivalReview } from "@/lib/cancellation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { surveyId, customerId, arrived, fixed, offlineSuggested, comment } = body;

    if (!surveyId || !customerId || typeof arrived !== "boolean" || !fixed || !offlineSuggested) {
      return NextResponse.json({ error: "Missing required survey answers" }, { status: 400 });
    }

    const surveyRef = adminDb.collection("leakageSurveys").doc(surveyId);
    const surveySnap = await surveyRef.get();

    if (!surveySnap.exists) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const survey = surveySnap.data();
    if (survey?.customerId !== customerId) {
      return NextResponse.json({ error: "Unauthorized customer" }, { status: 403 });
    }

    await surveyRef.update({
      arrived,
      fixed,
      offlineSuggested,
      comment: comment || null,
      submittedAt: Date.now()
    });

    // Execute automated review resolution
    const result = await resolveAfterArrivalReview(surveyId);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Survey submission error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
