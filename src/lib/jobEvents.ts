import { Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { JobEvent } from "@/types/platform";

/**
 * Writes a JobEvent to the append-only timeline.
 * Should be called inside a transaction whenever possible, but can also run independently.
 */
export async function writeJobEvent(
  jobId: string,
  type: JobEvent["type"],
  actorId: string | "system",
  payload: Record<string, unknown>,
  tx?: Transaction
): Promise<JobEvent> {
  const eventRef = adminDb.collection("jobRequests").doc(jobId).collection("events").doc();
  
  const eventData: JobEvent = {
    eventId: eventRef.id,
    type,
    actorId,
    payload,
    at: Date.now()
  };

  if (tx) {
    tx.set(eventRef, eventData);
  } else {
    await eventRef.set(eventData);
  }

  return eventData;
}
