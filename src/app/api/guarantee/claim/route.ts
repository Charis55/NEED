import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getConfig } from "@/lib/platformConfig";
import { writeJobEvent } from "@/lib/jobEvents";
import { verifyUserRequest } from "@/lib/userAuthGuard";
import { GuaranteeClaim, JobRequestData } from "@/types/platform";
import { validateGuaranteeClaimEligibility } from "@/lib/guarantee";

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const body = await req.json();
    const { jobId, description, photos = [] } = body;
    const customerId = authCheck.user.uid;

    if (!jobId || !description) {
      return NextResponse.json({ error: "Missing required claim details" }, { status: 400 });
    }

    const config = await getConfig();

    return await adminDb.runTransaction(async (tx) => {
      const jobRef = adminDb.collection("jobRequests").doc(jobId);
      const jobSnap = await tx.get(jobRef);

      if (!jobSnap.exists) {
        throw new Error("Job not found");
      }

      const job = jobSnap.data() as JobRequestData;

      const validation = validateGuaranteeClaimEligibility(job, config, customerId, description);
      if (!validation.eligible) {
        throw new Error(validation.error || "Job is not eligible for guarantee claim.");
      }

      const claimRef = adminDb.collection("guaranteeClaims").doc();
      const claim: GuaranteeClaim = {
        claimId: claimRef.id,
        jobId,
        customerId,
        artisanId: job.artisanId,
        description,
        photos,
        status: "submitted",
        createdAt: Date.now()
      };

      tx.set(claimRef, claim);

      // Move job to disputed state
      tx.update(jobRef, {
        state: "disputed",
        stateUpdatedAt: Date.now(),
        guaranteeClaimId: claimRef.id
      });

      await writeJobEvent(
        jobId,
        "guarantee_claim_opened",
        customerId,
        { claimId: claimRef.id, description },
        tx
      );

      return NextResponse.json({ success: true, claimId: claimRef.id });
    });
  } catch (error: any) {
    console.error("Guarantee claim error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
