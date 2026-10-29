import { NextRequest, NextResponse } from "next/server";
import { recordManualArrival } from "@/lib/locationTracker";
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

    if (!jobId) {
      return NextResponse.json({ error: "Missing required jobId parameter" }, { status: 400 });
    }

    const result = await recordManualArrival({ jobId, artisanId, lat, lng });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Manual arrival error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
