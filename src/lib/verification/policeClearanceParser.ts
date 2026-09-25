/**
 * Police Character Certificate (PCC) text parser.
 *
 * Parses raw OCR text from a Nigeria Police Force clearance certificate
 * into a PoliceClearanceExtraction structure.
 *
 * Key fields to extract:
 *  - Applicant name
 *  - POSSAP reference number (Police Service Automation Platform)
 *  - NIN or identification number shown on the document
 *  - Issue date (for expiry calculation)
 */

import { PoliceClearanceExtraction } from "@/types";

// POSSAP reference number patterns
// Format varies but typically: POSSAP/PCC/YYYY/XXXXXX or similar
const POSSAP_PATTERNS = [
  /possap[\/\-\s]*(?:pcc)?[\/\-\s]*(\d{4}[\/\-]\d{4,8})/i,
  /possap[\/\-\s]*ref(?:erence)?[:\s]*([A-Z0-9\-\/]+)/i,
  /reference\s*(?:no|number)?[:\s]*(POSSAP[\/\-][A-Z0-9\-\/]+)/i,
  /pcc\s*(?:no|number|ref)[:\s]*([A-Z0-9\-\/]+)/i,
  /application\s*(?:no|number|id)[:\s]*([A-Z0-9\-\/]+)/i,
];

// Identification number on the document (NIN, passport number, etc.)
const ID_NUMBER_PATTERNS = [
  /(?:nin|national\s+identification\s+number)[:\s]*(\d{11})/i,
  /(?:passport\s*(?:no|number))[:\s]*([A-Z]\d{8})/i,
  /(?:identification\s*(?:no|number))[:\s]*([A-Z0-9\-]{6,})/i,
];

// Name extraction patterns specific to police clearance format
const PCC_NAME_PATTERNS = [
  /(?:this\s+is\s+to\s+certify\s+that|name\s+of\s+applicant|applicant[:\s]+|name[:\s]+)\s*([A-Z][a-zA-Z\s.'-]{3,50})/i,
  /(?:mr|mrs|ms|engr|alhaji|chief)[.\s]+([A-Z][a-zA-Z\s.'-]{3,50})/i,
  /(?:certify\s+that)\s+([\w\s.'-]{5,50})\s+(?:whose|born|of|with)/i,
];

// Date patterns
const DATE_PATTERNS = [
  /(?:date\s*(?:of\s*)?issue)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /(?:issued\s*(?:on)?|dated)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /(?:date)[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*\d{4})/i,
];

/**
 * Parse raw OCR text from a police clearance certificate into structured data.
 */
export function parsePoliceClearanceText(
  ocrText: string,
  documentHash: string,
  tamperScore: number
): PoliceClearanceExtraction {
  const text = ocrText.trim();

  // Extract POSSAP reference number
  let possapReferenceNumber: string | null = null;
  for (const pattern of POSSAP_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      possapReferenceNumber = match[1].trim();
      break;
    }
  }

  // Extract identification number
  let identificationNumberOnDocument = "";
  for (const pattern of ID_NUMBER_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      identificationNumberOnDocument = match[1].trim();
      break;
    }
  }

  // Extract applicant name
  let applicantNameOnDocument = "";
  for (const pattern of PCC_NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      applicantNameOnDocument = match[1].trim().replace(/\s+/g, " ");
      break;
    }
  }

  // Fallback: ALL-CAPS name extraction
  if (!applicantNameOnDocument) {
    const capsMatch = text.match(/\b([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)\b/);
    if (capsMatch) {
      applicantNameOnDocument = capsMatch[1]
        .split(" ")
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  // Extract issue date
  let issueDate: string | null = null;
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      issueDate = match[1].trim();
      break;
    }
  }

  return {
    applicantNameOnDocument,
    identificationNumberOnDocument,
    possapReferenceNumber,
    issueDate,
    documentHash,
    tamperScore,
  };
}
