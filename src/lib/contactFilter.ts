export interface FilterResult {
  blocked: boolean;
  severity: "none" | "medium" | "high";
  reasons: string[];
  sanitized?: string;
}

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const HIGH_SEVERITY_KEYWORDS = [
  "take it offline",
  "take this offline",
  "do it offline",
  "handle this offline",
  "talk offline",
  "deal offline",
  "call my line",
  "call me on my line",
  "reach me on my line",
  "my line is",
  "send airtime",
  "send me airtime",
  "buy airtime",
  "check your whatsapp",
  "chat me on whatsapp",
  "message me on whatsapp",
  "text me on whatsapp",
  "reach me on whatsapp",
  "pay outside the app",
  "bypass the app"
];

const MEDIUM_KEYWORDS = [
  "whatsapp",
  "telegram",
  "instagram",
  "facebook",
  "dm me",
  "call me",
  "pay cash",
  "pay me cash",
  "outside the app",
  "off the app",
  "without the app",
  "no commission",
  "avoid commission",
  "bypass",
  "make we talk outside",
  "no pay for app",
  "pay outside",
  "deal direct",
  "deal directly"
];

/**
 * Normalizes text to detect obfuscated digits and numbers while preserving currency expressions.
 */
function normalizeForDigits(text: string): string {
  // 1. Lowercase and remove zero-width characters
  let clean = text.toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");

  // 2. Map digit words to digits
  for (const [word, digit] of Object.entries(DIGIT_WORDS)) {
    const reg = new RegExp(`\\b${word}\\b`, "gi");
    clean = clean.replace(reg, digit);
  }

  // 3. Handle 'oh' and 'o' between digits (e.g. 0 8 0 o 3 -> 08003)
  clean = clean.replace(/(?<=\d)\s*(?:oh|o)\s*(?=\d)/gi, "0");

  return clean;
}

/**
 * Pure function that analyzes a chat message for contact information leakage.
 */
export function analyzeMessage(rawText: string): FilterResult {
  if (!rawText || typeof rawText !== "string") {
    return { blocked: false, severity: "none", reasons: [] };
  }

  const reasons: string[] = [];
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Check for email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  if (emailRegex.test(text)) {
    reasons.push("email_detected");
  }

  // 2. Check for wa.me links, telegram links, or URLs
  const urlRegex = /(?:https?:\/\/|www\.)\S+|wa\.me\/\S+|t\.me\/\S+/i;
  if (urlRegex.test(text)) {
    reasons.push("url_or_link_detected");
  }

  // 3. Check for social handles (@username)
  // Ensure it's not preceded by price or email
  const handleRegex = /(?<!\w)@[a-zA-Z0-9_.]{3,25}\b/;
  if (handleRegex.test(text)) {
    reasons.push("social_handle_detected");
  }

  // 4. Normalized digit analysis for phone numbers
  const normalizedDigits = normalizeForDigits(lower);

  // Collapse spaces and typical separators (dots, dashes, slashes, underscores, parens) between digits
  // But be careful not to merge digits that have letters between them unless they were digit words
  const collapsed = normalizedDigits.replace(/(\d)[\s.\-_/\\(),]+(?=\d)/g, "$1");

  // Nigerian phone number formats:
  // e.g. 08012345678, 09012345678, 07012345678, +2348012345678, 2348012345678
  const nigerianPhoneRegex = /(?:\+?234|0)[789][01]\d{8}\b/;
  if (nigerianPhoneRegex.test(collapsed)) {
    reasons.push("phone_number_detected");
  }

  // Check for runs of 10 or more digits, EXCEPT when explicitly prefixed by currency markers
  // e.g. "₦15,000" or "15000 naira" is a price, not 10 digits. But 10+ digits is almost certainly a phone number or account number.
  const tenDigitsRegex = /(?<![₦nng\w])(\d{10,})(?!\s*(?:kobo|naira|ngn|k\b))/i;
  // Also check if text contains 10 or 11 digits in sequence
  if (tenDigitsRegex.test(collapsed) && !reasons.includes("phone_number_detected")) {
    reasons.push("long_digit_sequence_detected");
  }

  // Check for explicit high severity circumvention phrases
  for (const keyword of HIGH_SEVERITY_KEYWORDS) {
    if (lower.includes(keyword)) {
      reasons.push(`circumvention:${keyword}`);
    }
  }

  // If any high severity reason was detected
  if (reasons.length > 0) {
    return {
      blocked: true,
      severity: "high",
      reasons
    };
  }

  // 5. Check for medium severity keywords (circumvention phrases)
  for (const keyword of MEDIUM_KEYWORDS) {
    // Check whole phrase or boundary
    if (lower.includes(keyword)) {
      reasons.push(`keyword:${keyword}`);
    }
  }

  if (reasons.length > 0) {
    return {
      blocked: false, // Medium severity delivered but logged
      severity: "medium",
      reasons
    };
  }

  return {
    blocked: false,
    severity: "none",
    reasons: []
  };
}
