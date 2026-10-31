import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyUserRequest } from "@/lib/userAuthGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    const userId = authCheck.user.uid;
    const jobSnap = await adminDb.collection("jobRequests").doc(requestId).get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data()!;
    const isCustomer = job.customerId === userId;
    const isArtisan = job.artisanId === userId;

    if (!isCustomer && !isArtisan) {
      // Check admin status
      const userSnap = await adminDb.collection("users").doc(userId).get();
      const isAdmin = userSnap.exists && (userSnap.data()?.isAdmin || userSnap.data()?.role === "admin");
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden: Not a participant" }, { status: 403 });
      }
    }

    if (isCustomer) {
      // Customer is viewing -> fetch artisan details
      const partnerId = job.artisanId;
      if (!partnerId) {
        return NextResponse.json({
          success: true,
          partner: {
            id: null,
            name: job.artisanName || "Technician",
            photoURL: job.artisanPhoto || null,
            role: "artisan",
          },
        });
      }

      const [artisanSnap, userSnap] = await Promise.all([
        adminDb.collection("artisans").doc(partnerId).get(),
        adminDb.collection("users").doc(partnerId).get(),
      ]);

      const artisanData = artisanSnap.exists ? artisanSnap.data() : null;
      const userData = userSnap.exists ? userSnap.data() : null;

      const name =
        artisanData?.businessName ||
        artisanData?.name ||
        userData?.displayName ||
        (userData?.firstName ? `${userData.firstName} ${userData.lastName || ""}`.trim() : null) ||
        job.artisanName ||
        "Technician";

      const photoURL =
        artisanData?.profilePictureUrl ||
        userData?.photoURL ||
        job.artisanPhoto ||
        null;

      return NextResponse.json({
        success: true,
        partner: {
          id: partnerId,
          name,
          photoURL,
          role: "artisan",
          businessName: artisanData?.businessName || null,
          trade: artisanData?.trade || job.trade || null,
          verified: Boolean(artisanData?.verified),
        },
      });
    } else {
      // Artisan is viewing -> fetch customer details
      const partnerId = job.customerId;
      if (!partnerId) {
        return NextResponse.json({
          success: true,
          partner: {
            id: null,
            name: job.customerName || "Customer",
            photoURL: job.customerPhoto || null,
            role: "customer",
          },
        });
      }

      const userSnap = await adminDb.collection("users").doc(partnerId).get();
      const userData = userSnap.exists ? userSnap.data() : null;

      const name =
        userData?.displayName ||
        userData?.name ||
        (userData?.firstName ? `${userData.firstName} ${userData.lastName || ""}`.trim() : null) ||
        job.customerName ||
        "Customer";

      const photoURL =
        userData?.photoURL ||
        job.customerPhoto ||
        null;

      return NextResponse.json({
        success: true,
        partner: {
          id: partnerId,
          name,
          photoURL,
          role: "customer",
        },
      });
    }
  } catch (error: any) {
    console.error("[chat/partner-details] Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

