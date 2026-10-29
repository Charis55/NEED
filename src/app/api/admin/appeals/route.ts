import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Strike } from "@/types/platform";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyAdminRequest(req);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";

    let strikesQuery: FirebaseFirestore.Query = adminDb.collection("strikes");

    if (status !== "all") {
      strikesQuery = strikesQuery.where("appealStatus", "==", status);
    } else {
      // Exclude strikes that have never been appealed (appealStatus === "none" or undefined)
      // Since Firestore doesn't support != directly with other queries easily, we can filter in memory or query appealStatus in ["pending", "approved", "rejected"]
      strikesQuery = strikesQuery.where("appealStatus", "in", ["pending", "approved", "rejected"]);
    }

    const snap = await strikesQuery.get();

    const appeals = await Promise.all(
      snap.docs.map(async (docSnap) => {
        const strike = { strikeId: docSnap.id, ...docSnap.data() } as Strike;

        // Fetch user metadata
        let userName = "Unknown User";
        let userEmail = "";
        let userPhone = "";
        let role = strike.userType || "customer";

        try {
          const userDoc = await adminDb.collection("users").doc(strike.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userName = userData?.fullName || userData?.name || `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim() || userName;
            userEmail = userData?.email || "";
            userPhone = userData?.phone || "";
            if (userData?.role) role = userData.role;
          }

          if (role === "artisan" || strike.userType === "artisan") {
            const artisanDoc = await adminDb.collection("artisans").doc(strike.userId).get();
            if (artisanDoc.exists) {
              const artisanData = artisanDoc.data();
              if (artisanData?.businessName) {
                userName = `${artisanData.businessName} (${userName})`;
              }
              if (!userPhone && artisanData?.phone) userPhone = artisanData.phone;
            }
          }
        } catch (e) {
          console.warn("Could not enrich user info for appeal:", strike.userId, e);
        }

        return {
          ...strike,
          userName,
          userEmail,
          userPhone,
          userRole: role
        };
      })
    );

    // Sort appeals by appealedAt descending (newest first)
    appeals.sort((a, b) => (b.appealedAt || b.issuedAt) - (a.appealedAt || a.issuedAt));

    return NextResponse.json({ appeals });
  } catch (error: any) {
    console.error("Admin fetch appeals error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
