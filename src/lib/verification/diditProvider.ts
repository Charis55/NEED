/**
 * Didit identity verification provider.
 * Implements the IIdentityVerificationProvider interface.
 *
 * Requires env vars:
 *   DIDIT_API_KEY
 *
 * Docs: https://docs.didit.me/api-reference/overview
 *
 * Didit uses a single unified endpoint:
 *   POST https://verification.didit.me/v3/database-validation/
 * with a service_id to distinguish NIN vs BVN.
 *
 * Service IDs:
 *   NIN → nga_national_id
 *   BVN → nga_bank_verification_number
 */

import {
  IIdentityVerificationProvider,
  IdentityVerificationResult,
  SelfieMatchResult,
} from "./identityProvider";

const DIDIT_BASE_URL =
  process.env.DIDIT_BASE_URL || "https://verification.didit.me";

function getHeaders(): Record<string, string> {
  const apiKey = process.env.DIDIT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Didit credentials missing. Set DIDIT_API_KEY in environment."
    );
  }

  return {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function extractName(data: any): string | null {
  if (data.first_name || data.last_name) {
    return [data.first_name, data.middle_name, data.last_name]
      .filter(Boolean)
      .join(" ");
  }
  if (data.full_name) return data.full_name;
  if (data.name) return data.name;
  return null;
}

/**
 * Call the Didit database-validation endpoint.
 * service_id: "nga_national_id" | "nga_bank_verification_number"
 */
async function databaseValidation(
  serviceId: string,
  idNumber: string,
  extraFields?: Record<string, unknown>
): Promise<IdentityVerificationResult> {
  try {
    const body: Record<string, unknown> = {
      issuing_state: "NGA",
      services: [
        {
          service_id: serviceId,
          id_number: idNumber,
          ...extraFields,
        },
      ],
    };

    const res = await fetch(`${DIDIT_BASE_URL}/v3/database-validation/`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok || json.error || json.detail) {
      return {
        success: false,
        verifiedName: null,
        dateOfBirth: null,
        referenceId: null,
        photoUrl: null,
        error:
          json.error?.message ||
          json.detail ||
          json.message ||
          `Didit validation failed (${res.status})`,
      };
    }

    // Didit returns results per-service
    const serviceResult =
      json.results?.[0] || json.data?.results?.[0] || json.results || json.data || json;

    const entity = serviceResult.extracted_data || serviceResult.data || serviceResult;

    return {
      success: true,
      verifiedName: extractName(entity),
      dateOfBirth: entity.date_of_birth || entity.dob || null,
      referenceId: idNumber,
      photoUrl: entity.photo || entity.image || entity.portrait || null,
    };
  } catch (err: any) {
    return {
      success: false,
      verifiedName: null,
      dateOfBirth: null,
      referenceId: null,
      photoUrl: null,
      error: err.message || "Network error contacting Didit",
    };
  }
}

export class DiditProvider implements IIdentityVerificationProvider {
  readonly providerName = "didit";

  async verifyNIN(nin: string): Promise<IdentityVerificationResult> {
    return databaseValidation("nga_national_id", nin);
  }

  async verifyBVN(bvn: string): Promise<IdentityVerificationResult> {
    return databaseValidation("nga_bank_verification_number", bvn);
  }

  async compareSelfie(
    selfieBase64: string,
    referencePhotoUrl: string
  ): Promise<SelfieMatchResult> {
    // Didit does face matching as part of the BVN database-validation call,
    // not as a separate endpoint. For standalone selfie comparison we
    // return a not-supported response so the onboarding flow can proceed
    // without a crash and flag for manual admin review.
    return {
      match: false,
      confidence: 0,
      error: "Selfie comparison is handled inside Didit's BVN validation workflow",
    };
  }
}
