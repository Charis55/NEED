import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { JobRequestData } from "@/types/platform";
import { Review } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, customerId, rating, comment = "", photos = [] } = body;

    if (!jobId || !customerId || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid review parameters" }, { status: 400 });
    }

    const jobRef = adminDb.collection("jobRequests").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data() as JobRequestData;

    // Must be the customer
    if (job.customerId !== customerId) {
      return NextResponse.json({ error: "Unauthorized: Only the customer who booked the job can review." }, { status: 403 });
    }

    // Gating rule: job MUST be completed and commission settled
    if (job.state !== "completed" || !job.commissionSettled) {
      return NextResponse.json({
        error: "Reviews can only be submitted for completed, verified on-platform bookings."
      }, { status: 400 });
    }

    // Check if review already exists
    const existingReviews = await adminDb
      .collection("reviews")
      .where("requestId", "==", jobId)
      .limit(1)
      .get();

    if (!existingReviews.empty) {
      return NextResponse.json({ error: "Review has already been submitted for this job." }, { status: 400 });
    }

    const reviewRef = adminDb.collection("reviews").doc();
    const reviewData: any = {
      reviewId: reviewRef.id,
      requestId: jobId,
      jobId,
      customerId,
      artisanId: job.artisanId,
      jobTitle: job.trade || "Service",
      rating,
      comment,
      photos,
      createdAt: Date.now()
    };

    await reviewRef.set(reviewData);

    // Also update artisan settled completed count if not already synced
    const artisanRef = adminDb.collection("artisans").doc(job.artisanId);
    await artisanRef.set({
      completedOnNeedCount: (await adminDb.collection("jobRequests").where("artisanId", "==", job.artisanId).where("commissionSettled", "==", true).get()).size,
      rankingMultiplier: 1.0
    }, { merge: true });

    return NextResponse.json({ success: true, reviewId: reviewRef.id });
  } catch (error: any) {
    console.error("Submit review error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
