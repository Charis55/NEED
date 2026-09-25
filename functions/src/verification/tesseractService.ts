import Tesseract from "tesseract.js";

export interface OCRResult {
  fullText: string;
  confidence: number;
  error?: string;
}

/**
 * Extract text from a document image using Tesseract.js.
 * This runs entirely within the Node.js process.
 *
 * @param imageUrl - Public URL to the document image
 */
export async function extractDocumentTextLocal(imageUrl: string): Promise<OCRResult> {
  try {
    const worker = await Tesseract.createWorker("eng");
    const { data: { text, confidence } } = await worker.recognize(imageUrl);
    await worker.terminate();

    return {
      fullText: text || "",
      confidence: confidence ? confidence / 100 : 0.5,
    };
  } catch (err: any) {
    console.error("Tesseract error:", err);
    return {
      fullText: "",
      confidence: 0,
      error: err.message || "Failed to extract text with Tesseract",
    };
  }
}
