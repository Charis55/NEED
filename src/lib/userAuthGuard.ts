import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdminAuth";

export interface VerifiedUser {
  uid: string;
  email?: string;
  phone?: string;
}

/**
 * Extracts and cryptographically verifies the Firebase ID token
 * from the request's Authorization header (Bearer <token>).
 * Prevents IDOR (Insecure Direct Object Reference) and spoofed client IDs.
 */
export async function verifyUserRequest(
  req: NextRequest
): Promise<{ user: VerifiedUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }> {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized: Missing Authorization Bearer token" },
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
    return {
      user: {
        uid: decoded.uid,
        email: decoded.email,
        phone: decoded.phone_number
      }
    };
  } catch (err: any) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Invalid or expired token" },
        { status: 401 }
      )
    };
  }
}
