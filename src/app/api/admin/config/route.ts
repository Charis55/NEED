import { NextRequest, NextResponse } from "next/server";
import { getConfig, updatePlatformConfig } from "@/lib/platformConfig";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await verifyAdminRequest(req);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const config = await getConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyAdminRequest(req);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await req.json();
    const { updates, note } = body;
    const adminId = authCheck.admin.email || authCheck.admin.uid;

    if (!updates) {
      return NextResponse.json({ error: "Missing required config updates" }, { status: 400 });
    }

    const updated = await updatePlatformConfig(updates, adminId, note);
    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    console.error("Config update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
