import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import JobCompletedEmail from '@/emails/JobCompletedEmail';
import { adminAuth } from '@/lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { customerId, technicianName, trade, amount } = await req.json();

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    const userRecord = await adminAuth.getUser(customerId);
    const email = userRecord.email;
    const customerName = userRecord.displayName || 'Customer';

    if (!email) {
      return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'NEED App <onboarding@resend.dev>', // Change to your domain after verifying it in Resend
      to: [email],
      subject: 'Your job is complete - Receipt Enclosed',
      react: JobCompletedEmail({ customerName, technicianName, trade, amount }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending job completed email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
