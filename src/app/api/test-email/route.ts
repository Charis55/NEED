import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import TechnicianApprovedEmail from '@/emails/TechnicianApprovedEmail';

// Create a Resend instance. It will automatically use the RESEND_API_KEY environment variable.
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, technicianName } = body;

    const data = await resend.emails.send({
      from: 'NEED App <onboarding@resend.dev>', // Change this once you verify your own domain
      to: [to],
      subject: 'You have been approved!',
      react: TechnicianApprovedEmail({ technicianName }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
