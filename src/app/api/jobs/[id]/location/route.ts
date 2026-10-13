import { NextRequest, NextResponse } from "next/server";
import { recordLocationPing } from "@/lib/locationTracker";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params;
    const body = await req.json();
    const { artisanId, lat, lng } = body;

    if (!jobId || !artisanId || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Missing required location parameters" }, { status: 400 });
    }

    const result = await recordLocationPing({ jobId, artisanId, lat, lng });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Location ping error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
