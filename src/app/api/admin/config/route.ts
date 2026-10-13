import { NextRequest, NextResponse } from "next/server";
import { getConfig, updatePlatformConfig } from "@/lib/platformConfig";

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { updates, adminId, note } = body;

    if (!updates || !adminId) {
      return NextResponse.json({ error: "Missing required config updates or adminId" }, { status: 400 });
    }

    const updated = await updatePlatformConfig(updates, adminId, note);
    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    console.error("Config update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
