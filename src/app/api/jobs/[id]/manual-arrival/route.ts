import { NextRequest, NextResponse } from "next/server";
import { recordManualArrival } from "@/lib/locationTracker";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const body = await req.json();
    const { artisanId, lat, lng } = body;

    if (!jobId || !artisanId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const result = await recordManualArrival({ jobId, artisanId, lat, lng });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Manual arrival error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
