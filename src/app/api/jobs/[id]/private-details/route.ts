import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { JobRequestData, JobPrivateDetails } from "@/types/platform";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const userId = req.headers.get("x-user-id");

    if (!jobId || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobRef = adminDb.collection("jobRequests").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data() as JobRequestData;

    // Check caller role
    const isCustomer = job.customerId === userId;
    const isArtisan = job.artisanId === userId;

    // Check user record for admin claim/role
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const isAdmin = userSnap.exists && (userSnap.data()?.isAdmin || userSnap.data()?.role === "admin");

    if (!isCustomer && !isArtisan && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Not a participant" }, { status: 403 });
    }

    // If artisan, address is only revealed if deposit is paid / job is confirmed or later
    if (isArtisan && !isAdmin) {
      const allowedStates = [
        "confirmed",
        "en_route",
        "arrived",
        "in_progress",
        "awaiting_customer_confirmation",
        "completed"
      ];

      if (!allowedStates.includes(job.state)) {
        return NextResponse.json({
          error: "Address is hidden until the customer deposit is confirmed."
        }, { status: 403 });
      }
    }

    const privateRef = jobRef.collection("private").doc("details");
    const privateSnap = await privateRef.get();

    if (!privateSnap.exists) {
      // Fallback: If not separated into subcollection yet, return top-level fallback
      return NextResponse.json({
        exactAddress: (job as any).address || job.neighborhood,
        exactLat: job.approxLat,
        exactLng: job.approxLng,
        accessNotes: (job as any).accessNotes || null
      });
    }

    const details = privateSnap.data() as JobPrivateDetails;
    return NextResponse.json(details);

  } catch (error: any) {
    console.error("Private details error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
