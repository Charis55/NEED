import { NextRequest, NextResponse } from "next/server";
import { processJobCancellation } from "@/lib/cancellation";
import { verifyUserRequest } from "@/lib/userAuthGuard";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCheck = await verifyUserRequest(req);
    if (authCheck.errorResponse) {
      return authCheck.errorResponse;
    }

    const { id: jobId } = await params;
    const body = await req.json();
    const { cancelledBy, reasonCode, notes } = body;

    const isAdmin = authCheck.user.email === "obunezicharis@gmail.com";
    const actorId = isAdmin && body.actorId ? body.actorId : authCheck.user.uid;

    if (!jobId || !cancelledBy || !actorId || !reasonCode) {
      return NextResponse.json({ error: "Missing required cancellation fields" }, { status: 400 });
    }

    const result = await processJobCancellation({
      jobId,
      cancelledBy,
      actorId,
      reasonCode,
      notes
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Job cancellation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
