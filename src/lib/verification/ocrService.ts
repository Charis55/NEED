/**
 * Google Cloud Vision OCR wrapper for document text extraction.
 *
 * Requires:
 *  - GOOGLE_CLOUD_VISION_API_KEY env var
 *    OR a service account configured via GOOGLE_APPLICATION_CREDENTIALS
 *
 * Falls back to the REST API with an API key for simplicity in the
 * Vercel/Next.js environment (no gRPC).
 */

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";

export interface OCRResult {
  fullText: string;
  confidence: number;
  error?: string;
}

/**
 * Extract text from a document image using Google Cloud Vision.
 *
 * @param imageSource - Either a public URL or a base64-encoded image string
 * @param isBase64 - Set to true if imageSource is base64, false for URL
 */
export async function extractDocumentText(
  imageSource: string,
  isBase64: boolean = false
): Promise<OCRResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    return {
      fullText: "",
      confidence: 0,
      error: "GOOGLE_CLOUD_VISION_API_KEY is not set",
    };
  }

  try {
    const imagePayload = isBase64
      ? { content: imageSource }
      : { source: { imageUri: imageSource } };

    const requestBody = {
      requests: [
        {
          image: imagePayload,
          features: [
            {
              type: "DOCUMENT_TEXT_DETECTION",
              maxResults: 1,
            },
          ],
        },
      ],
    };

    const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        fullText: "",
        confidence: 0,
        error: `Vision API error (${response.status}): ${errorBody}`,
      };
    }

    const json = await response.json();
    const annotationResponse = json.responses?.[0];

    if (annotationResponse?.error) {
      return {
        fullText: "",
        confidence: 0,
        error: `Vision API annotation error: ${annotationResponse.error.message}`,
      };
    }

    const fullTextAnnotation = annotationResponse?.fullTextAnnotation;

    if (!fullTextAnnotation) {
      // No text detected — could be a blank image or non-document
      return {
        fullText: "",
        confidence: 0,
        error: "No text detected in document",
      };
    }

    // Compute average confidence across all pages/blocks
    let totalConfidence = 0;
    let blockCount = 0;
    for (const page of fullTextAnnotation.pages || []) {
      for (const block of page.blocks || []) {
        if (block.confidence !== undefined) {
          totalConfidence += block.confidence;
          blockCount++;
        }
      }
    }

    return {
      fullText: fullTextAnnotation.text || "",
      confidence: blockCount > 0 ? totalConfidence / blockCount : 0.5,
    };
  } catch (err: any) {
    return {
      fullText: "",
      confidence: 0,
      error: err.message || "Failed to call Vision API",
    };
  }
}
