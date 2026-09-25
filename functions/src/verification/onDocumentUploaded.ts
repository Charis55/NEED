import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { extractDocumentTextLocal } from "./tesseractService";
import { parseCertificateText } from "./certificateParser";
import { parsePoliceClearanceText } from "./policeClearanceParser";

/**
 * Cloud Function: Triggered when an artisan profile is created or updated.
 * Handles:
 *  - OCR extraction of certificate and police clearance documents via Tesseract
 *  - Name cross-matching between verified identity and document names
 *  - Duplicate document hash detection across all artisans
 *  - Updating the verification review queue
 */

const db = admin.firestore();

// Simplified name comparison
function normalizeNameForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,\-'"]/g, " ")
    .replace(/\b(mr|mrs|ms|dr|prof|engr|chief|alhaji|hajia)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(name: string): string[] {
  return normalizeNameForComparison(name).split(" ").filter(Boolean).sort();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyNameMatch(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  const tokens1 = tokenize(name1);
  const tokens2 = tokenize(name2);
  if (tokens1.length === 0 && tokens2.length === 0) return 1;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matched = 0;
  const used = new Set<number>();
  for (const t1 of tokens1) {
    let bestScore = 0;
    let bestIdx = -1;
    for (let j = 0; j < tokens2.length; j++) {
      if (used.has(j)) continue;
      const t2 = tokens2[j];
      const maxLen = Math.max(t1.length, t2.length);
      const score = maxLen === 0 ? 1 : 1 - levenshtein(t1, t2) / maxLen;
      // Handle initials
      const adjustedScore = (t1.length === 1 && t2.startsWith(t1)) || (t2.length === 1 && t1.startsWith(t2)) ? 0.85 : score;
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIdx = j;
      }
    }
    if (bestScore >= 0.6 && bestIdx >= 0) {
      matched += bestScore;
      used.add(bestIdx);
    }
  }
  return matched / Math.max(tokens1.length, tokens2.length);
}

/**
 * Compute a SHA-256 hash of a document's content fetched from URL.
 * For duplicate detection across artisans.
 */
async function computeDocumentHash(documentUrl: string): Promise<string> {
  try {
    const response = await fetch(documentUrl);
    const buffer = await response.arrayBuffer();
    const hash = crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    return hash;
  } catch (err) {
    console.error("Failed to compute document hash:", err);
    return "";
  }
}

/**
 * Check for duplicate documents across all artisans.
 */
async function checkForDuplicates(
  artisanId: string,
  documentHash: string,
  documentType: "certificate" | "policeClearance"
): Promise<{ isDuplicate: boolean; matchedArtisanId?: string }> {
  if (!documentHash) return { isDuplicate: false };

  const snapshot = await db.collection("artisans").get();

  for (const doc of snapshot.docs) {
    if (doc.id === artisanId) continue; // Skip self

    const data = doc.data();

    if (documentType === "certificate" && data.certificateExtractedData?.documentHash === documentHash) {
      return { isDuplicate: true, matchedArtisanId: doc.id };
    }
    if (documentType === "policeClearance" && data.policeClearanceExtractedData?.documentHash === documentHash) {
      return { isDuplicate: true, matchedArtisanId: doc.id };
    }
  }

  return { isDuplicate: false };
}

const NAME_MATCH_THRESHOLD = 0.75;

/**
 * Triggered on artisan profile creation.
 * Runs the verification pipeline on uploaded documents.
 * We set memory to 1GB because Tesseract can be memory intensive.
 */
export const onArtisanProfileCreated = functions.runWith({ memory: '1GB', timeoutSeconds: 120 }).firestore
  .document("artisans/{artisanId}")
  .onCreate(async (snap, context) => {
    const artisanId = context.params.artisanId;
    const data = snap.data();

    if (!data) return null;

    const verifiedName = data.identityVerifiedName || "";
    const reasons: string[] = [];

    // --- Process Certificate ---
    const certificateUrl = data.services?.[0]?.certificateUrl || data.certificateUrl;
    let certificateExtractedData = null;

    if (certificateUrl) {
      try {
        const docHash = await computeDocumentHash(certificateUrl);

        // Check for duplicates
        const dupCheck = await checkForDuplicates(artisanId, docHash, "certificate");
        if (dupCheck.isDuplicate) {
          reasons.push(`duplicate_certificate_detected_matches_${dupCheck.matchedArtisanId}`);
        }

        // Run Tesseract OCR
        console.log(`Running OCR on certificate for ${artisanId}`);
        const ocrResult = await extractDocumentTextLocal(certificateUrl);
        
        if (ocrResult.error) {
           reasons.push("certificate_ocr_failed");
        } else {
           // Parse the extracted text
           certificateExtractedData = parseCertificateText(ocrResult.fullText, docHash, 0);
           
           if (certificateExtractedData.applicantNameOnDocument) {
             const nameScore = fuzzyNameMatch(verifiedName, certificateExtractedData.applicantNameOnDocument);
             if (nameScore < NAME_MATCH_THRESHOLD) {
                reasons.push("certificate_name_mismatch");
             }
           } else {
             reasons.push("certificate_name_not_found");
           }
        }
      } catch (err) {
        console.error("Certificate processing error:", err);
        reasons.push("certificate_processing_error");
      }
    }

    // --- Process Police Clearance ---
    const policeClearanceUrl = data.policeClearanceUrl;
    let policeClearanceExtractedData = null;

    if (policeClearanceUrl) {
      try {
        const docHash = await computeDocumentHash(policeClearanceUrl);

        // Check for duplicates
        const dupCheck = await checkForDuplicates(artisanId, docHash, "policeClearance");
        if (dupCheck.isDuplicate) {
          reasons.push(`duplicate_police_clearance_detected_matches_${dupCheck.matchedArtisanId}`);
        }

        // Run Tesseract OCR
        console.log(`Running OCR on police clearance for ${artisanId}`);
        const ocrResult = await extractDocumentTextLocal(policeClearanceUrl);
        
        if (ocrResult.error) {
           reasons.push("police_clearance_ocr_failed");
        } else {
           // Parse the extracted text
           policeClearanceExtractedData = parsePoliceClearanceText(ocrResult.fullText, docHash, 0);
           
           if (policeClearanceExtractedData.applicantNameOnDocument) {
             const nameScore = fuzzyNameMatch(verifiedName, policeClearanceExtractedData.applicantNameOnDocument);
             if (nameScore < NAME_MATCH_THRESHOLD) {
                reasons.push("police_clearance_name_mismatch");
             }
           } else {
             reasons.push("police_clearance_name_not_found");
           }
           
           if (!policeClearanceExtractedData.possapReferenceNumber) {
             reasons.push("police_clearance_possap_ref_not_found");
           }
        }
      } catch (err) {
        console.error("Police clearance processing error:", err);
        reasons.push("police_clearance_processing_error");
      }
    } else {
      reasons.push("police_clearance_not_uploaded");
    }

    // --- Update artisan profile with extracted data ---
    const updateData: any = {
      certificateExtractedData,
      policeClearanceExtractedData,
    };

    if (reasons.length > 0) {
      updateData.manualReviewRequired = true;
      updateData.manualReviewReasons = admin.firestore.FieldValue.arrayUnion(...reasons);
    }

    // Calculate police clearance expiry (6 months from now as a default)
    if (policeClearanceUrl) {
      const sixMonthsFromNow = Date.now() + 6 * 30 * 24 * 60 * 60 * 1000;
      updateData.policeClearanceExpiryDate = sixMonthsFromNow;
    }

    await db.collection("artisans").doc(artisanId).update(updateData);

    // Update review queue with extracted data
    if (reasons.length > 0) {
      await db.collection("verificationReviewQueue").doc(artisanId).update({
        flaggedChecks: admin.firestore.FieldValue.arrayUnion(...reasons),
        extractedData: {
          certificate: certificateExtractedData,
          policeClearance: policeClearanceExtractedData,
          identityVerifiedName: verifiedName,
        },
      });
    }

    console.log(`Verification pipeline completed for artisan ${artisanId}. Flags: ${reasons.join(", ") || "none"}`);
    return null;
  });
