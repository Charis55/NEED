import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isValidTransition, ActorRole, TransitionGuard } from "@/lib/jobStateMachine";
import { writeJobEvent } from "@/lib/jobEvents";
import { JobRequestData, JobState } from "@/types/platform";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, toState, actorId, actorRole, guard, payload } = body;

    if (!jobId || !toState || !actorId || !actorRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newJobData = await adminDb.runTransaction(async (tx) => {
      const jobRef = adminDb.collection("jobRequests").doc(jobId);
      const jobSnap = await tx.get(jobRef);

      if (!jobSnap.exists) {
        throw new Error("Job not found");
      }

      const job = jobSnap.data() as JobRequestData;
      const fromState = job.state;

      // Ensure the actor is authorized for this job
      if (actorRole === "customer" && job.customerId !== actorId) {
         throw new Error("Unauthorized: Not the customer for this job");
      }
      if (actorRole === "artisan" && job.artisanId !== actorId) {
         throw new Error("Unauthorized: Not the artisan for this job");
      }

      // Check transition legality
      if (!isValidTransition(fromState, toState as JobState, actorRole as ActorRole, guard as TransitionGuard)) {
         throw new Error(`Invalid transition from ${fromState} to ${toState} by ${actorRole}`);
      }

      // Special guard evaluations (server authoritative checks)
      if (guard === "priceAgreed") {
         if (!job.agreedPrice) throw new Error("Guard failed: priceAgreed (agreedPrice is null)");
      }
      if (guard === "depositPaidOrNotRequired") {
         if (job.depositRequired && job.depositPaid < job.depositRequired) {
            throw new Error("Guard failed: depositPaidOrNotRequired");
         }
      }

      const newStateUpdatedAt = Date.now();
      
      const updates: Partial<JobRequestData> = {
        state: toState as JobState,
        stateUpdatedAt: newStateUpdatedAt
      };

      tx.update(jobRef, updates);

      // Write to event timeline
      await writeJobEvent(
        jobId,
        "state_change",
        actorId,
        { from: fromState, to: toState, guard, ...payload },
        tx
      );

      return { ...job, ...updates };
    });

    return NextResponse.json({ success: true, job: newJobData });

  } catch (error: any) {
    console.error("transitionJob error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
