/**
 * Fuzzy name matching utility for the verification pipeline.
 *
 * Handles common Nigerian name variations:
 *  - Middle name presence/absence
 *  - Initials vs full names ("A." vs "Adebayo")
 *  - OCR transliteration errors
 *  - Different name orderings
 *
 * Uses token-set ratio (order-independent) + Levenshtein for character-level similarity.
 */

/**
 * Compute Levenshtein edit distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

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

/**
 * Normalized Levenshtein similarity (0 = completely different, 1 = identical).
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Normalize a name string for comparison:
 *  - Lowercase
 *  - Strip punctuation (periods, commas, hyphens used inconsistently)
 *  - Collapse whitespace
 *  - Remove common titles
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,\-'"]/g, " ")
    .replace(/\b(mr|mrs|ms|dr|prof|engr|chief|alhaji|hajia)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize a name into individual words (sorted for order-independent comparison).
 */
function tokenize(name: string): string[] {
  return normalizeName(name).split(" ").filter(Boolean).sort();
}

/**
 * Check if a token is likely an initial (single letter, possibly with a period).
 */
function isInitial(token: string): boolean {
  return token.length === 1;
}

/**
 * Token-set similarity: compares two names ignoring token order.
 * Handles initials by matching them against the first letter of full tokens.
 */
function tokenSetSimilarity(name1: string, name2: string): number {
  const tokens1 = tokenize(name1);
  const tokens2 = tokenize(name2);

  if (tokens1.length === 0 && tokens2.length === 0) return 1;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matched = 0;
  const used2 = new Set<number>();

  for (const t1 of tokens1) {
    let bestScore = 0;
    let bestIdx = -1;

    for (let j = 0; j < tokens2.length; j++) {
      if (used2.has(j)) continue;
      const t2 = tokens2[j];

      let score: number;

      // Handle initial matching: "a" should match "adebayo"
      if (isInitial(t1) && t2.startsWith(t1)) {
        score = 0.85; // High but not perfect — initial match is plausible but not certain
      } else if (isInitial(t2) && t1.startsWith(t2)) {
        score = 0.85;
      } else {
        score = levenshteinSimilarity(t1, t2);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestScore >= 0.6 && bestIdx >= 0) {
      matched += bestScore;
      used2.add(bestIdx);
    }
  }

  const maxTokens = Math.max(tokens1.length, tokens2.length);
  return matched / maxTokens;
}

export interface NameComparisonResult {
  /** Overall similarity score from 0 to 1 */
  score: number;
  /** Human-readable explanation of the comparison */
  details: string;
  /** Whether the names are considered a match at the given threshold */
  isMatch: boolean;
}

/**
 * Compare two names and return a similarity score with explanation.
 *
 * @param name1 - First name (e.g. from identity verification)
 * @param name2 - Second name (e.g. from document OCR extraction)
 * @param threshold - Minimum score to consider a match (default 0.75)
 */
export function compareNames(
  name1: string,
  name2: string,
  threshold: number = 0.75
): NameComparisonResult {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match after normalization
  if (norm1 === norm2) {
    return {
      score: 1.0,
      details: `Exact match: "${norm1}"`,
      isMatch: true,
    };
  }

  // Token-set similarity (order-independent, handles initials)
  const tokenScore = tokenSetSimilarity(name1, name2);

  // Character-level similarity on the full normalized strings
  const charScore = levenshteinSimilarity(norm1, norm2);

  // Weighted combination: token-set matters more than raw character similarity
  // because name order and missing middle names are the most common variations
  const score = tokenScore * 0.7 + charScore * 0.3;

  let details: string;
  if (score >= 0.95) {
    details = `Very high confidence match (${(score * 100).toFixed(1)}%): "${norm1}" ≈ "${norm2}"`;
  } else if (score >= threshold) {
    details = `Plausible match (${(score * 100).toFixed(1)}%): "${norm1}" vs "${norm2}" — likely the same person with name variation`;
  } else if (score >= 0.5) {
    details = `Low confidence (${(score * 100).toFixed(1)}%): "${norm1}" vs "${norm2}" — names partially overlap but significant differences`;
  } else {
    details = `No match (${(score * 100).toFixed(1)}%): "${norm1}" vs "${norm2}" — names appear to belong to different people`;
  }

  return {
    score: Math.round(score * 1000) / 1000,
    details,
    isMatch: score >= threshold,
  };
}
