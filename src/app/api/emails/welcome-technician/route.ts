import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import WelcomeTechnicianEmail from '@/emails/WelcomeTechnicianEmail';
import { adminAuth } from '@/lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { artisanId } = await req.json();

    if (!artisanId) {
      return NextResponse.json({ error: 'Missing artisanId' }, { status: 400 });
    }

    const userRecord = await adminAuth.getUser(artisanId);
    const email = userRecord.email;
    const technicianName = userRecord.displayName || 'Technician';

    if (!email) {
      return NextResponse.json({ error: 'Technician has no email address' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'NEED App <onboarding@resend.dev>', // Change to your domain after verifying it in Resend
      to: [email],
      subject: 'Welcome to the Team!',
      react: WelcomeTechnicianEmail({ technicianName }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending welcome technician email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
