import { NextRequest, NextResponse } from "next/server";
import { processJobCancellation } from "@/lib/cancellation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const body = await req.json();
    const { cancelledBy, actorId, reasonCode, notes } = body;

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
