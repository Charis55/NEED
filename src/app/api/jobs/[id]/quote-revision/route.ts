import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { writeJobEvent } from "@/lib/jobEvents";
import { JobRequestData, QuoteRevision } from "@/types/platform";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const body = await req.json();
    const { artisanId, additionalAmount, reason, photos = [] } = body;

    if (!jobId || !artisanId || !additionalAmount || !reason) {
      return NextResponse.json({ error: "Missing required revision fields" }, { status: 400 });
    }

    const jobRef = adminDb.collection("jobRequests").doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data() as JobRequestData;
    if (job.artisanId !== artisanId) {
      return NextResponse.json({ error: "Unauthorized artisan" }, { status: 403 });
    }

    if (job.state !== "in_progress") {
      return NextResponse.json({ error: "Quote revisions can only be requested while job is in progress." }, { status: 400 });
    }

    const revRef = jobRef.collection("quoteRevisions").doc();
    const revision: QuoteRevision = {
      revisionId: revRef.id,
      jobId,
      artisanId,
      additionalAmount,
      reason,
      photos,
      status: "pending",
      createdAt: Date.now()
    };

    await revRef.set(revision);

    await writeJobEvent(
      jobId,
      "quote_revision_requested",
      artisanId,
      { revisionId: revRef.id, additionalAmount, reason }
    );

    return NextResponse.json({ success: true, revision });
  } catch (error: any) {
    console.error("Quote revision request error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const body = await req.json();
    const { revisionId, customerId, action } = body; // action: "approve" | "reject"

    if (!jobId || !revisionId || !customerId || !action) {
      return NextResponse.json({ error: "Missing required resolution fields" }, { status: 400 });
    }

    return await adminDb.runTransaction(async (tx) => {
      const jobRef = adminDb.collection("jobRequests").doc(jobId);
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) throw new Error("Job not found");

      const job = jobSnap.data() as JobRequestData;
      if (job.customerId !== customerId) throw new Error("Unauthorized customer");

      const revRef = jobRef.collection("quoteRevisions").doc(revisionId);
      const revSnap = await tx.get(revRef);
      if (!revSnap.exists) throw new Error("Revision not found");

      const revision = revSnap.data() as QuoteRevision;
      if (revision.status !== "pending") throw new Error("Revision is already resolved");

      if (action === "approve") {
        const newAgreedPrice = (job.agreedPrice || 0) + revision.additionalAmount;
        tx.update(jobRef, {
          agreedPrice: newAgreedPrice,
          lastApprovedRevisionId: revisionId
        });

        tx.update(revRef, {
          status: "approved",
          resolvedAt: Date.now()
        });

        await writeJobEvent(
          jobId,
          "quote_revision_approved",
          customerId,
          { revisionId, newAgreedPrice, additionalAmount: revision.additionalAmount },
          tx
        );

        return NextResponse.json({ success: true, status: "approved", newAgreedPrice });
      } else {
        tx.update(revRef, {
          status: "rejected",
          resolvedAt: Date.now()
        });

        return NextResponse.json({ success: true, status: "rejected" });
      }
    });
  } catch (error: any) {
    console.error("Quote revision resolution error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
