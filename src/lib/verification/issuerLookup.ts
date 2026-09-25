/**
 * Issuer-specific certificate verification lookup.
 *
 * For certifying bodies with public verification portals
 * (e.g. WAEC, NECO), this module attempts automated lookup
 * by certificate number.
 *
 * Where no portal exists (most Nigerian trade bodies),
 * the certificate routes straight to "flagged" for manual
 * review BY DESIGN. We do NOT silently skip verification —
 * the admin should see explicitly that this certificate type
 * has no automated authority to check against.
 */

export interface IssuerLookupResult {
  /** Whether an automated verification portal exists for this issuer */
  portalAvailable: boolean;
  /** Whether the lookup succeeded and the certificate was verified */
  verified: boolean;
  /** Details about the lookup result */
  details: string;
  /** If verified, any additional data from the portal */
  portalData?: Record<string, string>;
}

// Registry of issuers with known verification portals
const ISSUER_PORTALS: Record<
  string,
  {
    name: string;
    portalUrl: string;
    lookup: (certNumber: string) => Promise<IssuerLookupResult>;
  }
> = {
  // WAEC has a result verification portal
  waec: {
    name: "WAEC",
    portalUrl: "https://www.waecdirect.org",
    lookup: async (certNumber: string) => {
      // WAEC's verification requires exam number + year + exam type
      // which we may not have from OCR alone.
      // For now, flag for manual verification with a link to the portal.
      return {
        portalAvailable: true,
        verified: false,
        details: `WAEC verification portal exists at waecdirect.org. Certificate number "${certNumber}" requires manual verification through the portal (exam year and type also needed).`,
      };
    },
  },

  // NECO has a result verification portal
  neco: {
    name: "NECO",
    portalUrl: "https://result.neco.gov.ng",
    lookup: async (certNumber: string) => {
      return {
        portalAvailable: true,
        verified: false,
        details: `NECO verification portal exists at result.neco.gov.ng. Certificate number "${certNumber}" requires manual verification through the portal.`,
      };
    },
  },
};

// Issuers with NO known verification portal
const ISSUERS_WITHOUT_PORTALS = [
  "NABTEB",
  "ITF",
  "City & Guilds",
  "Federal Ministry of Labour and Employment",
  "Government Trade Test",
];

/**
 * Determine which issuer a certificate belongs to and attempt verification.
 *
 * @param issuingBody - The issuing body name (from OCR extraction)
 * @param certificateNumber - The certificate number (from OCR extraction)
 */
export async function lookupCertificateWithIssuer(
  issuingBody: string,
  certificateNumber: string
): Promise<IssuerLookupResult> {
  const bodyLower = issuingBody.toLowerCase();

  // Check if we have a portal for this issuer
  for (const [key, portal] of Object.entries(ISSUER_PORTALS)) {
    if (bodyLower.includes(key)) {
      return portal.lookup(certificateNumber);
    }
  }

  // Check if it's a known issuer without a portal
  for (const issuer of ISSUERS_WITHOUT_PORTALS) {
    if (bodyLower.includes(issuer.toLowerCase())) {
      return {
        portalAvailable: false,
        verified: false,
        details: `No automated verification portal available for ${issuer}. Certificate number "${certificateNumber}" must be manually verified by an admin.`,
      };
    }
  }

  // Unknown issuer
  return {
    portalAvailable: false,
    verified: false,
    details: `Unknown issuing body: "${issuingBody}". No automated verification available. Certificate number "${certificateNumber}" must be manually verified by an admin.`,
  };
}
