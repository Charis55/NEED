import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { 
  blacklistDocumentManually, 
  removeDocumentFromBlacklist 
} from "@/lib/strikes";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch blacklisted documents (passports, driver's licenses, ID cards)
    const [docsSnap, legacyNinSnap, custSnap, artisansSnap] = await Promise.all([
      adminDb.collection("blacklistedDocuments").orderBy("bannedAt", "desc").get(),
      adminDb.collection("blacklistedNINs").orderBy("bannedAt", "desc").get(),
      adminDb.collection("blacklistedCustomers").orderBy("bannedAt", "desc").get(),
      adminDb.collection("artisans").limit(50).get()
    ]);

    const documentsMap = new Map<string, any>();
    docsSnap.forEach(d => {
      documentsMap.set(d.id, { id: d.id, ...d.data() });
    });
    // Add legacy entries if not already present
    legacyNinSnap.forEach(d => {
      if (!documentsMap.has(d.id)) {
        documentsMap.set(d.id, { 
          id: d.id, 
          documentNumber: d.id, 
          documentType: "government_id", 
          ...d.data() 
        });
      }
    });

    const blacklistedCustomers = custSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // Fetch technicians with KYC data for easy inspection
    const techniciansWithKyc = artisansSnap.docs.map(d => {
      const data = d.data();
      return {
        userId: d.id,
        businessName: data.businessName || data.name || "Unnamed Technician",
        trade: data.trade || "General",
        verified: data.verified || false,
        kycStatus: data.kycStatus || data.identityVerificationStatus || "not_started",
        documentType: data.identityDocumentType || "passport_or_id",
        documentNumber: data.identityDocumentNumber || data.identityVerificationReference || null,
        verifiedName: data.identityVerifiedName || null,
        dob: data.identityVerifiedDOB || null,
        nationality: data.identityNationality || null,
        kycSessionId: data.kycSessionId || null,
        banned: data.banned || false,
        deactivated: data.deactivated || false,
        isBlacklisted: documentsMap.has(String(data.identityDocumentNumber || data.identityVerificationReference || "").toUpperCase())
      };
    });

    return NextResponse.json({
      success: true,
      blacklistedDocuments: Array.from(documentsMap.values()),
      blacklistedCustomers,
      techniciansWithKyc
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("Admin blacklist fetch error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch blacklist records" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      type, // "document" | "customer_phone" | "customer_email"
      value, // document number, phone, or email
      documentType = "passport",
      userId,
      reason,
      adminId = "admin_console"
    } = body;

    if (!value || !reason) {
      return NextResponse.json(
        { error: "Value and reason are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (type === "document") {
      await blacklistDocumentManually({
        documentNumber: value,
        documentType,
        userId,
        reason,
        adminId
      });
      return NextResponse.json({
        success: true,
        message: `Document ${value} permanently blacklisted`
      }, { headers: corsHeaders });
    }

    if (type === "customer_phone" || type === "customer_email") {
      const cleanKey = type === "customer_phone" 
        ? String(value).replace(/\s/g, "")
        : String(value).toLowerCase().trim();

      await adminDb.collection("blacklistedCustomers").doc(cleanKey).set({
        key: cleanKey,
        type: type === "customer_phone" ? "phone" : "email",
        userId: userId || null,
        bannedAt: Date.now(),
        bannedBy: adminId,
        reason,
        source: "manual_admin_blacklist"
      });

      if (userId) {
        await adminDb.collection("users").doc(userId).set({
          banned: true,
          active: false,
          bannedAt: Date.now(),
          banReason: `Manually blacklisted by admin: ${reason}`
        }, { merge: true });
      }

      return NextResponse.json({
        success: true,
        message: `Customer contact ${cleanKey} blacklisted`
      }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid blacklist type" },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Admin blacklist add error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to blacklist identity" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "document" | "customer"
    const key = searchParams.get("key");
    const adminId = searchParams.get("adminId") || "admin_console";

    if (!key) {
      return NextResponse.json(
        { error: "Key is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (type === "document") {
      await removeDocumentFromBlacklist(key, adminId);
      return NextResponse.json({
        success: true,
        message: `Document ${key} removed from blacklist`
      }, { headers: corsHeaders });
    }

    if (type === "customer") {
      const cleanKey = String(key).replace(/\s/g, "").toLowerCase();
      await adminDb.collection("blacklistedCustomers").doc(cleanKey).delete();
      return NextResponse.json({
        success: true,
        message: `Customer ${cleanKey} removed from blacklist`
      }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid blacklist type" },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Admin blacklist delete error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to remove identity from blacklist" },
      { status: 500, headers: corsHeaders }
    );
  }
}
