import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyAdminRequest(req);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const sessionId = searchParams.get("sessionId");

    if (!userId && !sessionId) {
      return NextResponse.json(
        { error: "userId or sessionId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    let artisanData: any = null;
    let targetSessionId = sessionId;

    if (userId) {
      const snap = await adminDb.collection("artisans").doc(userId).get();
      if (snap.exists) {
        artisanData = snap.data();
        if (!targetSessionId && artisanData.kycSessionId) {
          targetSessionId = artisanData.kycSessionId;
        }
      }
    }

    let diditDecision: any = null;
    const apiKey = process.env.DIDIT_API_KEY;
    const baseUrl = process.env.DIDIT_BASE_URL || "https://verification.didit.me";

    // If session ID and API key available, reach into Didit's live session decision endpoint
    if (targetSessionId && apiKey) {
      try {
        const diditRes = await fetch(`${baseUrl}/v3/session/${targetSessionId}/decision/`, {
          headers: {
            "x-api-key": apiKey,
            Accept: "application/json"
          }
        });
        if (diditRes.ok) {
          diditDecision = await diditRes.json();
        }
      } catch (diditErr) {
        console.warn("Could not query Didit live API for session:", diditErr);
      }
    }

    // Check blacklist status of document number if present
    const docNumber = 
      artisanData?.identityDocumentNumber || 
      artisanData?.identityVerificationReference || 
      diditDecision?.id_verifications?.[0]?.document_number;

    let isBlacklisted = false;
    let blacklistReason = "";
    if (docNumber) {
      const clean = String(docNumber).toUpperCase().replace(/\s/g, "");
      const bDoc = await adminDb.collection("blacklistedDocuments").doc(clean).get();
      if (bDoc.exists) {
        isBlacklisted = true;
        blacklistReason = bDoc.data()?.reason || "Blacklisted";
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      sessionId: targetSessionId,
      artisan: artisanData ? {
        name: artisanData.businessName || artisanData.name,
        trade: artisanData.trade,
        verified: artisanData.verified,
        kycStatus: artisanData.kycStatus || artisanData.identityVerificationStatus,
        documentType: artisanData.identityDocumentType || "passport_or_id",
        documentNumber: artisanData.identityDocumentNumber || artisanData.identityVerificationReference,
        verifiedName: artisanData.identityVerifiedName,
        nationality: artisanData.identityNationality,
        livenessScore: artisanData.kycLivenessScore,
        faceMatchScore: artisanData.kycFaceMatchScore,
        declineReasons: artisanData.kycDeclineReasons
      } : null,
      diditDecision,
      blacklist: {
        isBlacklisted,
        reason: blacklistReason,
        documentNumber: docNumber || null
      }
    }, { headers: corsHeaders });

  } catch (err: any) {
    console.error("Admin KYC inspection error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to inspect Didit KYC session" },
      { status: 500, headers: corsHeaders }
    );
  }
}
