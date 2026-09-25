import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import WelcomeCustomerEmail from '@/emails/WelcomeCustomerEmail';
import { adminAuth } from '@/lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const userRecord = await adminAuth.getUser(userId);
    const email = userRecord.email;
    const userName = userRecord.displayName || 'Customer';

    if (!email) {
      return NextResponse.json({ error: 'User has no email address' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'NEED App <onboarding@resend.dev>', // Change to your domain after verifying it in Resend
      to: [email],
      subject: 'Welcome to NEED!',
      react: WelcomeCustomerEmail({ userName }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending welcome customer email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
