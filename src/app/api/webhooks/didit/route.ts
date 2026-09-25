/**
 * POST /api/webhooks/didit — Didit verification webhook handler.
 *
 * When a user completes (or abandons, fails, etc.) their KYC verification,
 * Didit sends a signed webhook here. We:
 *   1. Verify the X-Signature-V2 HMAC
 *   2. Enforce 300s timestamp freshness
 *   3. Update the artisan's Firestore document with the verification decision
 *
 * The webhook is the ONLY source of truth for verification decisions.
 * Never trust the SDK onComplete callback or redirect as proof of approval.
 */

import crypto from "node:crypto";
import { adminDb } from "@/lib/firebaseAdmin";

// ─── Canonicalisation helpers for X-Signature-V2 ─────────────────────────────
// Whole-number floats (1.0) → integers (1), recursively. Matches Didit's server canonicalisation.
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)])
    );
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

// Recursive lexicographic key sort (array order preserved).
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-signature-v2") ?? "";
  const ts = Number(req.headers.get("x-timestamp"));

  const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

  // If no webhook secret is configured, log the event but skip signature verification
  // This allows the integration to work during development before webhook is configured
  if (!webhookSecret) {
    console.warn("DIDIT_WEBHOOK_SECRET not set — skipping signature verification (DEV ONLY)");
    const parsed = JSON.parse(raw);
    await handleEvent(parsed);
    return new Response("ok");
  }

  // 1. Freshness — reject anything older/newer than 300s (replay protection)
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
    console.error("Didit webhook rejected: stale timestamp", { ts, now: Date.now() / 1000 });
    return new Response("stale", { status: 401 });
  }

  // 2. Canonicalise (shortenFloats → sortKeys → JSON.stringify with unescaped Unicode)
  const parsed = JSON.parse(raw);
  const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));

  // 3. Constant-time HMAC-SHA256 compare against X-Signature-V2
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(canonical, "utf8")
    .digest("hex");

  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  ) {
    console.error("Didit webhook rejected: bad signature");
    return new Response("bad sig", { status: 401 });
  }

  // 4. Idempotency — dedupe on event_id (unique per delivery attempt).
  const eventId = parsed.event_id;
  if (eventId) {
    const eventRef = adminDb.collection("diditWebhookEvents").doc(eventId);
    const eventDoc = await eventRef.get();
    if (eventDoc.exists) {
      console.log(`Didit webhook: skipping already processed event ${eventId}`);
      return new Response("ok");
    }
    // Mark as processed immediately
    await eventRef.set({
      processedAt: Date.now(),
      status: parsed.status,
      sessionId: parsed.session_id,
    });
  }

  // 5. Handle the event
  await handleEvent(parsed);

  // 6. Return 2xx within 5 seconds
  return new Response("ok");
}

// ─── Event dispatcher ────────────────────────────────────────────────────────
async function handleEvent(event: any) {
  const userId = event.vendor_data; // This is the artisan's Firebase UID
  const sessionId = event.session_id;
  const status = event.status;

  console.log(`Didit webhook: session=${sessionId} status="${status}" vendor_data=${userId}`);

  if (!userId || userId === "anonymous") {
    console.warn("Didit webhook: no vendor_data (userId), cannot update Firestore");
    return;
  }

  // Build the Firestore update based on the status
  const update: Record<string, any> = {
    kycSessionId: sessionId,
    kycStatus: status,
    kycUpdatedAt: Date.now(),
  };

  switch (status) {
    case "Approved": {
      update.identityVerificationStatus = "verified";
      update.kycApprovedAt = Date.now();

      // Extract verified name from the decision if available
      const decision = event.decision;
      if (decision) {
        // V3 uses plural arrays — id_verifications[]
        const idVerification = decision.id_verifications?.[0];
        if (idVerification) {
          const firstName = idVerification.first_name || "";
          const lastName = idVerification.last_name || "";
          const fullName = [firstName, lastName].filter(Boolean).join(" ");
          if (fullName) {
            update.identityVerifiedName = fullName;
          }
          if (idVerification.date_of_birth) {
            update.identityVerifiedDOB = idVerification.date_of_birth;
          }
          if (idVerification.document_number) {
            update.identityVerificationReference = idVerification.document_number;
          }
          if (idVerification.nationality) {
            update.identityNationality = idVerification.nationality;
          }
        }

        // Store liveness & face match results
        const livenessCheck = decision.liveness_checks?.[0];
        if (livenessCheck) {
          update.kycLivenessStatus = livenessCheck.status;
          update.kycLivenessScore = livenessCheck.score;
        }

        const faceMatch = decision.face_matches?.[0];
        if (faceMatch) {
          update.kycFaceMatchStatus = faceMatch.status;
          update.kycFaceMatchScore = faceMatch.score;
        }
      }
      break;
    }

    case "Declined": {
      update.identityVerificationStatus = "failed";

      // Log decline reasons from the decision
      const decision = event.decision;
      if (decision) {
        const idVerification = decision.id_verifications?.[0];
        if (idVerification?.warnings) {
          update.kycDeclineReasons = idVerification.warnings;
        }
      }
      break;
    }

    case "In Review":
      update.identityVerificationStatus = "pending_review";
      break;

    case "In Progress":
      update.identityVerificationStatus = "in_progress";
      break;

    case "Resubmitted":
      update.identityVerificationStatus = "resubmitted";
      if (event.resubmit_info?.nodes_to_resubmit) {
        update.kycResubmitNodes = event.resubmit_info.nodes_to_resubmit;
      }
      break;

    case "Abandoned":
      update.identityVerificationStatus = "abandoned";
      break;

    case "Expired":
      update.identityVerificationStatus = "expired";
      break;

    case "Kyc Expired":
      update.identityVerificationStatus = "kyc_expired";
      break;

    case "Not Started":
    case "Awaiting User":
    default:
      // Log but don't change verification status for these
      break;
  }

  // Update the artisan document
  try {
    await adminDb.collection("artisans").doc(userId).set(update, { merge: true });
    console.log(`Didit webhook: updated artisan ${userId} with status "${status}"`);
  } catch (err) {
    console.error(`Didit webhook: failed to update artisan ${userId}:`, err);
  }
}
