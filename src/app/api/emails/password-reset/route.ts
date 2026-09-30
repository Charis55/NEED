import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminAuth } from '@/lib/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate the password reset link using Firebase Admin
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    // Prepare the brutalist HTML
    const htmlContent = `
<div style="font-family: 'Courier New', Courier, monospace; background-color: #ffffff; padding: 20px; color: #000000;">
  <div style="border: 4px solid #000000; box-shadow: 4px 4px 0px 0px #000000; padding: 30px; max-width: 500px; margin: 0 auto; background-color: #ffffff;">
    <h1 style="text-transform: uppercase; font-weight: 900; margin-top: 0; font-family: sans-serif; letter-spacing: -1px; font-size: 28px;">Password Reset</h1>
    <p style="font-size: 16px; font-weight: bold; line-height: 1.5; margin-bottom: 20px; font-family: sans-serif;">Hello,</p>
    <p style="font-size: 16px; font-weight: bold; line-height: 1.5; margin-bottom: 20px; font-family: sans-serif;">Follow this link to reset your NEED password for your <span style="background-color: #CCFF00; padding: 2px 6px; border: 2px solid #000;">${email}</span> account.</p>
    <div style="margin: 30px 0;">
      <a href="${resetLink}" style="display: inline-block; background-color: #FF4D4D; color: #ffffff; text-decoration: none; padding: 12px 24px; font-weight: 900; font-family: sans-serif; text-transform: uppercase; border: 4px solid #000000; box-shadow: 4px 4px 0px 0px #000000; font-size: 16px;">Reset Password</a>
    </div>
    <p style="font-size: 14px; font-weight: bold; line-height: 1.5; margin-bottom: 20px; font-family: sans-serif; color: #555;">If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${resetLink}" style="color: #000; word-break: break-all;">${resetLink}</a></p>
    <hr style="border: 0; border-top: 4px solid #000; margin: 30px 0;">
    <p style="font-size: 14px; font-weight: bold; line-height: 1.5; font-family: sans-serif;">If you didn’t ask to reset your password, you can ignore this email.</p>
    <p style="font-size: 14px; font-weight: bold; font-family: sans-serif; margin-top: 20px;">Thanks,<br>Your NEED team</p>
  </div>
</div>
    `;

    // Send the email via Resend
    const data = await resend.emails.send({
      from: 'NEED App <onboarding@resend.dev>', // Verify your domain to change this
      to: email,
      subject: 'Reset your NEED Password',
      html: htmlContent,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Password Reset Email Error:', error);
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'auth/user-not-found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 });
  }
}
