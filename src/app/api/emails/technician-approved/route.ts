import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import TechnicianApprovedEmail from '@/emails/TechnicianApprovedEmail';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { artisanId } = await req.json();

    if (!artisanId) {
      return NextResponse.json({ error: 'Missing artisanId' }, { status: 400 });
    }

    // 1. Get the artisan profile to know their name
    const artisanDoc = await adminDb.collection('artisans').doc(artisanId).get();
    if (!artisanDoc.exists) {
      return NextResponse.json({ error: 'Artisan not found' }, { status: 404 });
    }
    const artisanData = artisanDoc.data();
    const technicianName = artisanData?.name || artisanData?.identityVerifiedName || 'Technician';

    // 2. Get the artisan's email from Firebase Auth
    const userRecord = await adminAuth.getUser(artisanId);
    const email = userRecord.email;

    if (!email) {
      return NextResponse.json({ error: 'Technician has no email address' }, { status: 400 });
    }

    // 3. Send the email via Resend
    const data = await resend.emails.send({
      from: 'NEED App <onboarding@resend.dev>', // Change to your domain (e.g. hello@need.com) after verifying it in Resend
      to: [email],
      subject: 'You have been approved!',
      react: TechnicianApprovedEmail({ technicianName }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error sending approval email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
