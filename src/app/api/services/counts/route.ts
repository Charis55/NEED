import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { servicesData } from "@/data/services";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categorySlug = searchParams.get("categorySlug") || "";
    const tradeParam = searchParams.get("trade") || "";

    // Determine category title from servicesData or query param
    const category = servicesData[categorySlug];
    const targetTrade = (tradeParam || category?.title || categorySlug).trim().toLowerCase();

    // Query all verified and available artisans
    const snap = await adminDb
      .collection("artisans")
      .where("available", "==", true)
      .where("verified", "==", true)
      .get();

    const counts: Record<string, number> = {};
    let totalMatchingArtisans = 0;

    snap.forEach((doc) => {
      const data = doc.data();
      let matchedThisArtisan = false;

      // Check services array
      if (data.services && Array.isArray(data.services)) {
        data.services.forEach((svc: { trade?: string; subcategory?: string; [key: string]: unknown }) => {
          const svcTrade = (svc.trade || "").trim().toLowerCase();
          const svcSub = (svc.subcategory || "").trim();
          if (svcTrade === targetTrade && svcSub) {
            counts[svcSub] = (counts[svcSub] || 0) + 1;
            matchedThisArtisan = true;
          }
        });
      }

      // Check primary trade/subcategory
      const primaryTrade = (data.trade || "").trim().toLowerCase();
      const primarySub = (data.subcategory || "").trim();
      if (primaryTrade === targetTrade && primarySub) {
        // If not already counted for this artisan
        if (!data.services || !Array.isArray(data.services) || !data.services.some((s: any) => (s.subcategory || '').trim().toLowerCase() === primarySub.toLowerCase())) {
          counts[primarySub] = (counts[primarySub] || 0) + 1;
        }
        matchedThisArtisan = true;
      }

      if (matchedThisArtisan) {
        totalMatchingArtisans++;
      }
    });

    return NextResponse.json({
      success: true,
      trade: targetTrade,
      counts,
      totalArtisans: totalMatchingArtisans,
    });
  } catch (err: any) {
    console.error("Error fetching service counts:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch service counts" },
      { status: 500 }
    );
  }
}
