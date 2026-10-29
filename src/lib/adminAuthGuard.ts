import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdminAuth";

export const ADMIN_EMAILS = [
  "obunezicharis@gmail.com"
];

export interface VerifiedAdmin {
  uid: string;
  email?: string;
  admin: boolean;
}

/**
 * Validates the Authorization Bearer token from the incoming NextRequest.
 * Enforces server-side authentication and verifies admin privileges.
 */
export async function verifyAdminRequest(
  req: NextRequest
): Promise<{ admin: VerifiedAdmin; errorResponse?: never } | { admin?: never; errorResponse: NextResponse }> {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized: Missing or malformed Authorization header" },
          { status: 401 }
        )
      };
    }

    const idToken = authHeader.substring(7).trim();
    if (!idToken) {
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized: Empty authentication token" },
          { status: 401 }
        )
      };
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    const emailMatch = decoded.email && ADMIN_EMAILS.includes(decoded.email.toLowerCase());
    const hasAdminClaim = decoded.admin === true;

    if (!hasAdminClaim && !emailMatch) {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden: Administrative access required" },
          { status: 403 }
        )
      };
    }

    return {
      admin: {
        uid: decoded.uid,
        email: decoded.email,
        admin: true
      }
    };
  } catch (error: any) {
    console.error("Admin verification error:", error?.message || error);
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Invalid or expired authentication token" },
        { status: 401 }
      )
    };
  }
}
