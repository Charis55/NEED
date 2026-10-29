import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyAdminRequest } from "@/lib/adminAuthGuard";
import TechnicianApprovedEmail from "@/emails/TechnicianApprovedEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Endpoint disabled in production" }, { status: 404 });
  }

  const adminCheck = await verifyAdminRequest(req);
  if (adminCheck.errorResponse) {
    return adminCheck.errorResponse;
  }

  try {
    const body = await req.json();
    const { to, technicianName } = body;

    if (!to) {
      return NextResponse.json({ error: "Missing recipient 'to' email" }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: "NEED App <onboarding@resend.dev>",
      to: [to],
      subject: "You have been approved!",
      react: TechnicianApprovedEmail({ technicianName: technicianName || "Technician" }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
