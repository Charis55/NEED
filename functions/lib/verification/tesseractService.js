"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocumentTextLocal = extractDocumentTextLocal;
const tesseract_js_1 = require("tesseract.js");
/**
 * Extract text from a document image using Tesseract.js.
 * This runs entirely within the Node.js process.
 *
 * @param imageUrl - Public URL to the document image
 */
async function extractDocumentTextLocal(imageUrl) {
    try {
        const worker = await tesseract_js_1.default.createWorker("eng");
        const { data: { text, confidence } } = await worker.recognize(imageUrl);
        await worker.terminate();
        return {
            fullText: text || "",
            confidence: confidence ? confidence / 100 : 0.5,
        };
    }
    catch (err) {
        console.error("Tesseract error:", err);
        return {
            fullText: "",
            confidence: 0,
            error: err.message || "Failed to extract text with Tesseract",
        };
    }
}
//# sourceMappingURL=tesseractService.js.map