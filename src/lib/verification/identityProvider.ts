/**
 * Abstract interface for identity verification providers.
 * Designed so swapping providers (Didit, Smile ID, Youverify) later
 * requires only a new concrete implementation, not pipeline rewrites.
 */

export interface IdentityVerificationResult {
  success: boolean;
  verifiedName: string | null;
  dateOfBirth: string | null;
  referenceId: string | null;
  photoUrl: string | null;
  error?: string;
}

export interface SelfieMatchResult {
  match: boolean;
  confidence: number;
  error?: string;
}

export interface IIdentityVerificationProvider {
  /** Provider name, e.g. "didit", "smile_id", "youverify" */
  readonly providerName: string;

  /** Look up a National Identification Number */
  verifyNIN(nin: string): Promise<IdentityVerificationResult>;

  /** Look up a Bank Verification Number */
  verifyBVN(bvn: string): Promise<IdentityVerificationResult>;

  /**
   * Compare a selfie (base64 encoded) against the reference photo
   * returned by the NIN/BVN lookup.
   * Not all providers support this; implementations that don't
   * should return { match: false, confidence: 0, error: "not_supported" }.
   */
  compareSelfie(
    selfieBase64: string,
    referencePhotoUrl: string
  ): Promise<SelfieMatchResult>;
}
