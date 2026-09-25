import { NextRequest, NextResponse } from "next/server";
import { DiditProvider } from "@/lib/verification/diditProvider";

const provider = new DiditProvider();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, value } = body as { type: "nin" | "bvn"; value: string };

    if (!type || !value) {
      return NextResponse.json(
        { error: "Missing required fields: type and value" },
        { status: 400 }
      );
    }

    if (type !== "nin" && type !== "bvn") {
      return NextResponse.json(
        { error: "type must be 'nin' or 'bvn'" },
        { status: 400 }
      );
    }

    // Basic format validation
    const cleaned = value.replace(/\s/g, "");
    if (type === "nin" && !/^\d{11}$/.test(cleaned)) {
      return NextResponse.json(
        { error: "NIN must be exactly 11 digits" },
        { status: 400 }
      );
    }
    if (type === "bvn" && !/^\d{11}$/.test(cleaned)) {
      return NextResponse.json(
        { error: "BVN must be exactly 11 digits" },
        { status: 400 }
      );
    }

    const result =
      type === "nin"
        ? await provider.verifyNIN(cleaned)
        : await provider.verifyBVN(cleaned);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Verification failed",
          provider: provider.providerName,
        },
        { status: 200 } // 200 because the request itself succeeded; the identity check failed
      );
    }

    // Never return the raw NIN/BVN or full photo URL back to the client.
    // Only return what the onboarding flow needs.
    return NextResponse.json({
      success: true,
      verifiedName: result.verifiedName,
      referenceId: result.referenceId,
      dateOfBirth: result.dateOfBirth,
      hasPhoto: !!result.photoUrl,
      provider: provider.providerName,
    });
  } catch (err: any) {
    console.error("Identity verification error:", err);
    return NextResponse.json(
      { error: "Internal server error during identity verification" },
      { status: 500 }
    );
  }
}
