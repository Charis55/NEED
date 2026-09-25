/**
 * Trade certificate text parser.
 *
 * Parses raw OCR text into a CertificateExtraction structure.
 * Starts with NABTEB and ITF certificate formats — the most common
 * for Nigerian technical trades. Expand the parser list as new
 * formats appear rather than trying to handle every layout on day one.
 */

import { CertificateExtraction } from "@/types";

// Known issuing body patterns
const ISSUING_BODIES = [
  { pattern: /nabteb/i, name: "NABTEB (National Business and Technical Examinations Board)" },
  { pattern: /national\s+business\s+and\s+technical/i, name: "NABTEB (National Business and Technical Examinations Board)" },
  { pattern: /itf/i, name: "ITF (Industrial Training Fund)" },
  { pattern: /industrial\s+training\s+fund/i, name: "ITF (Industrial Training Fund)" },
  { pattern: /city\s*&?\s*guilds/i, name: "City & Guilds" },
  { pattern: /waec/i, name: "WAEC (West African Examinations Council)" },
  { pattern: /neco/i, name: "NECO (National Examinations Council)" },
  { pattern: /federal\s+ministry\s+of\s+labour/i, name: "Federal Ministry of Labour and Employment" },
  { pattern: /trade\s+test/i, name: "Government Trade Test" },
];

// Certificate number patterns (common formats)
const CERT_NUMBER_PATTERNS = [
  /cert(?:ificate)?\s*(?:no|number|#)[.:;\s]*([A-Z0-9\-/]+)/i,
  /no[.:;\s]*([A-Z0-9]{4,}[/-]?[A-Z0-9]+)/i,
  /registration\s*(?:no|number)[.:;\s]*([A-Z0-9\-/]+)/i,
  /exam\s*(?:no|number)[.:;\s]*([A-Z0-9\-/]+)/i,
  /candidate\s*(?:no|number)[.:;\s]*([A-Z0-9\-/]+)/i,
];

// Name extraction patterns
const NAME_PATTERNS = [
  /(?:this\s+is\s+to\s+certify\s+that|awarded\s+to|name\s+of\s+candidate|candidate[:\s]+|name[:\s]+)\s*([A-Z][a-zA-Z\s.'-]{3,50})/i,
  /(?:mr|mrs|ms|engr|alhaji|chief)[.\s]+([A-Z][a-zA-Z\s.'-]{3,50})/i,
];

// Date patterns (DD/MM/YYYY, DD-MM-YYYY, Month YYYY, etc.)
const DATE_PATTERNS = [
  /(?:date\s*(?:of\s*)?(?:issue|award|completion))[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /(?:issued|awarded|dated)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /(?:date)[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*\d{4})/i,
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
];

/**
 * Parse raw OCR text from a trade certificate into structured data.
 */
export function parseCertificateText(
  ocrText: string,
  documentHash: string,
  tamperScore: number
): CertificateExtraction {
  const text = ocrText.trim();

  // Extract issuing body
  let issuingBody = "Unknown";
  for (const body of ISSUING_BODIES) {
    if (body.pattern.test(text)) {
      issuingBody = body.name;
      break;
    }
  }

  // Extract certificate number
  let certificateNumber = "";
  for (const pattern of CERT_NUMBER_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      certificateNumber = match[1].trim();
      break;
    }
  }

  // Extract applicant name
  let applicantNameOnDocument = "";
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      applicantNameOnDocument = match[1].trim().replace(/\s+/g, " ");
      break;
    }
  }

  // Fallback: if no name found via patterns, look for ALL-CAPS sequences
  // (certificates often have the name in all caps)
  if (!applicantNameOnDocument) {
    const capsMatch = text.match(/\b([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)\b/);
    if (capsMatch) {
      applicantNameOnDocument = capsMatch[1]
        .split(" ")
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  // Extract date
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
    certificateNumber,
    issuingBody,
    issueDate,
    documentHash,
    tamperScore,
  };
}
