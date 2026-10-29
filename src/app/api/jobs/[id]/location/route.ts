import { NextRequest, NextResponse } from "next/server";
import { recordLocationPing } from "@/lib/locationTracker";
import { verifyUserRequest } from "@/lib/userAuthGuard";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const { id: jobId } = await params;
    const body = await req.json();
    const { lat, lng } = body;
    const artisanId = authCheck.user.uid;

    if (!jobId || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Missing required location parameters" }, { status: 400 });
    }

    const result = await recordLocationPing({ jobId, artisanId, lat, lng });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Location ping error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
