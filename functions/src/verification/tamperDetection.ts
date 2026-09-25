/**
 * Document tamper and fraud detection.
 *
 * Produces a tamperScore between 0 (clean) and 1 (highly suspicious).
 *
 * Checks:
 *  1. EXIF/metadata for editing software signatures (Photoshop, GIMP, Canva)
 *  2. File size heuristics (too small for a real scan = suspicious)
 *  3. Content-type consistency
 *
 * IMPORTANT: This analysis produces false positives on legitimately
 * low-quality phone-camera photos. Scores above the threshold flag
 * for manual review, NOT automatic rejection. (Per spec Section 6.3)
 *
 * Default threshold: 0.6 (scores above this get flagged)
 */

export interface TamperAnalysisResult {
  tamperScore: number;
  flags: string[];
  recommendation: "pass" | "flag_for_review";
}

// Software signatures commonly found in EXIF/metadata of edited documents
const EDITING_SOFTWARE_SIGNATURES = [
  "photoshop",
  "gimp",
  "canva",
  "illustrator",
  "inkscape",
  "paint.net",
  "pixlr",
  "fotor",
  "befunky",
  "picsart",
  "snapseed",
  "lightroom",
  "affinity",
  "corel",
  "sketch",
  "figma",
];

/**
 * Analyze a document's metadata for signs of tampering.
 *
 * This runs server-side. For images, it checks the raw bytes for
 * EXIF software tags and metadata anomalies. For PDFs, it checks
 * the producer/creator fields.
 *
 * @param fileBuffer - The raw file bytes
 * @param fileName - Original filename (for extension checking)
 * @param contentType - MIME type
 * @param fileSizeBytes - File size in bytes
 */
export function analyzeDocumentTamper(
  fileBuffer: Buffer | ArrayBuffer,
  fileName: string,
  contentType: string,
  fileSizeBytes: number
): TamperAnalysisResult {
  const flags: string[] = [];
  let score = 0;

  const buffer = fileBuffer instanceof ArrayBuffer ? Buffer.from(fileBuffer) : fileBuffer;
  const textContent = buffer.toString("utf-8", 0, Math.min(buffer.length, 4096));
  const textLower = textContent.toLowerCase();

  // --- Check 1: Editing software signatures in metadata/binary content ---
  for (const software of EDITING_SOFTWARE_SIGNATURES) {
    if (textLower.includes(software)) {
      flags.push(`Editing software detected: "${software}"`);
      score += 0.35;
      break; // One is enough to flag
    }
  }

  // PDF-specific: check Producer and Creator fields
  if (contentType === "application/pdf" || fileName.endsWith(".pdf")) {
    const producerMatch = textContent.match(/\/Producer\s*\(([^)]+)\)/i);
    const creatorMatch = textContent.match(/\/Creator\s*\(([^)]+)\)/i);

    for (const match of [producerMatch, creatorMatch]) {
      if (match) {
        const value = match[1].toLowerCase();
        for (const software of EDITING_SOFTWARE_SIGNATURES) {
          if (value.includes(software)) {
            flags.push(`PDF metadata contains editing software: "${match[1]}"`);
            score += 0.3;
            break;
          }
        }
      }
    }
  }

  // --- Check 2: File size heuristics ---
  // A real scanned document is typically > 100KB for images
  if (contentType.startsWith("image/") && fileSizeBytes < 50_000) {
    flags.push(`Suspiciously small image file (${(fileSizeBytes / 1024).toFixed(1)}KB)`);
    score += 0.15;
  }

  // Very large files for simple documents might indicate layered editing
  if (fileSizeBytes > 20_000_000) {
    flags.push(`Unusually large file (${(fileSizeBytes / 1_000_000).toFixed(1)}MB)`);
    score += 0.1;
  }

  // --- Check 3: Content-type vs extension mismatch ---
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf" && !contentType.includes("pdf")) {
    flags.push("File extension is .pdf but content type is not PDF");
    score += 0.2;
  }
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext) && contentType.includes("pdf")) {
    flags.push("File extension is an image format but content type is PDF");
    score += 0.2;
  }

  // --- Check 4: JPEG/PNG magic byte verification ---
  if (contentType.startsWith("image/")) {
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPNG =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47;

    if (!isJPEG && !isPNG && !contentType.includes("webp")) {
      flags.push("Image file does not have valid JPEG or PNG magic bytes");
      score += 0.15;
    }
  }

  // Clamp score to [0, 1]
  score = Math.min(1, Math.max(0, score));

  const TAMPER_THRESHOLD = 0.6;

  return {
    tamperScore: Math.round(score * 1000) / 1000,
    flags,
    recommendation: score >= TAMPER_THRESHOLD ? "flag_for_review" : "pass",
  };
}
