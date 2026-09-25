/**
 * Dojah identity verification provider.
 * Implements the IIdentityVerificationProvider interface.
 *
 * Requires env vars:
 *   DOJAH_APP_ID
 *   DOJAH_SECRET_KEY
 *   DOJAH_SANDBOX_KEY  (optional, for testing)
 *
 * Docs: https://docs.dojah.io
 */

import {
  IIdentityVerificationProvider,
  IdentityVerificationResult,
  SelfieMatchResult,
} from "./identityProvider";

const DOJAH_BASE_URL = "https://api.dojah.io";

function getHeaders(): Record<string, string> {
  const appId = process.env.DOJAH_APP_ID;
  const secretKey = process.env.DOJAH_SECRET_KEY;

  if (!appId || !secretKey) {
    throw new Error(
      "Dojah credentials missing. Set DOJAH_APP_ID and DOJAH_SECRET_KEY in environment."
    );
  }

  return {
    Authorization: secretKey,
    AppId: appId,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function extractName(data: any): string | null {
  // Dojah returns names in various fields depending on the lookup type
  if (data.first_name || data.last_name) {
    return [data.first_name, data.middle_name, data.last_name]
      .filter(Boolean)
      .join(" ");
  }
  if (data.full_name) return data.full_name;
  if (data.name) return data.name;
  return null;
}

export class DojahProvider implements IIdentityVerificationProvider {
  readonly providerName = "dojah";

  async verifyNIN(nin: string): Promise<IdentityVerificationResult> {
    try {
      const res = await fetch(
        `${DOJAH_BASE_URL}/api/v1/kyc/nin?nin=${encodeURIComponent(nin)}`,
        { method: "GET", headers: getHeaders() }
      );

      const json = await res.json();

      if (!res.ok || json.error) {
        return {
          success: false,
          verifiedName: null,
          dateOfBirth: null,
          referenceId: null,
          photoUrl: null,
          error: json.error?.message || json.message || `Dojah NIN lookup failed (${res.status})`,
        };
      }

      const entity = json.entity || json.data || json;

      return {
        success: true,
        verifiedName: extractName(entity),
        dateOfBirth: entity.date_of_birth || entity.dob || null,
        referenceId: entity.nin || nin,
        photoUrl: entity.photo || entity.image || null,
      };
    } catch (err: any) {
      return {
        success: false,
        verifiedName: null,
        dateOfBirth: null,
        referenceId: null,
        photoUrl: null,
        error: err.message || "Network error contacting Dojah",
      };
    }
  }

  async verifyBVN(bvn: string): Promise<IdentityVerificationResult> {
    try {
      const res = await fetch(
        `${DOJAH_BASE_URL}/api/v1/kyc/bvn?bvn=${encodeURIComponent(bvn)}`,
        { method: "GET", headers: getHeaders() }
      );

      const json = await res.json();

      if (!res.ok || json.error) {
        return {
          success: false,
          verifiedName: null,
          dateOfBirth: null,
          referenceId: null,
          photoUrl: null,
          error: json.error?.message || json.message || `Dojah BVN lookup failed (${res.status})`,
        };
      }

      const entity = json.entity || json.data || json;

      return {
        success: true,
        verifiedName: extractName(entity),
        dateOfBirth: entity.date_of_birth || entity.dob || null,
        referenceId: entity.bvn || bvn,
        photoUrl: entity.photo || entity.image || null,
      };
    } catch (err: any) {
      return {
        success: false,
        verifiedName: null,
        dateOfBirth: null,
        referenceId: null,
        photoUrl: null,
        error: err.message || "Network error contacting Dojah",
      };
    }
  }

  async compareSelfie(
    selfieBase64: string,
    referencePhotoUrl: string
  ): Promise<SelfieMatchResult> {
    try {
      const res = await fetch(
        `${DOJAH_BASE_URL}/api/v1/kyc/photoid/verify`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            selfie_image: selfieBase64,
            photoid_image: referencePhotoUrl,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || json.error) {
        return {
          match: false,
          confidence: 0,
          error: json.error?.message || json.message || "Selfie comparison failed",
        };
      }

      const entity = json.entity || json.data || json;
      const confidence = entity.confidence_level ?? entity.match_score ?? 0;
      // Dojah typically returns a match boolean or a confidence score
      const match = entity.match === true || confidence >= 70;

      return { match, confidence };
    } catch (err: any) {
      return {
        match: false,
        confidence: 0,
        error: err.message || "Network error during selfie comparison",
      };
    }
  }
}
