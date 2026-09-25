import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import TechnicianApprovedEmail from '@/emails/TechnicianApprovedEmail';
import AccountDeletedEmail from '@/emails/AccountDeletedEmail';
import WelcomeCustomerEmail from '@/emails/WelcomeCustomerEmail';
import WelcomeTechnicianEmail from '@/emails/WelcomeTechnicianEmail';
import NewJobRequestEmail from '@/emails/NewJobRequestEmail';
import JobCompletedEmail from '@/emails/JobCompletedEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const toEmail = "obunezicharis@gmail.com";
    const fromAddress = 'NEED App <onboarding@resend.dev>';

    // 1. Technician Approved
    await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: '[TEST] Technician Approved',
      react: TechnicianApprovedEmail({ technicianName: "Charis" }),
    });

    // 2. Account Deleted
    await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: '[TEST] Account Deleted',
      react: AccountDeletedEmail({ userName: "Charis" }),
    });

    // 3. Welcome Customer
    await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: '[TEST] Welcome Customer',
      react: WelcomeCustomerEmail({ userName: "Charis" }),
    });

    // 4. Welcome Technician
    await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: '[TEST] Welcome Technician',
      react: WelcomeTechnicianEmail({ technicianName: "Charis" }),
    });

    // 5. New Job Request
    await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: '[TEST] New Job Request',
      react: NewJobRequestEmail({ 
        technicianName: "Charis", 
        customerName: "John Doe",
        trade: "Plumbing",
        neighborhood: "Lekki Phase 1",
        preferredTime: "Tomorrow at 10:00 AM"
      }),
    });

    // 6. Job Completed (Receipt)
    await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: '[TEST] Job Completed (Receipt)',
      react: JobCompletedEmail({ 
        customerName: "John Doe",
        technicianName: "Charis",
        trade: "Plumbing",
        amount: 25000
      }),
    });

    return NextResponse.json({ success: true, message: "All 6 emails sent!" });
  } catch (error: any) {
    console.error('Error sending test emails:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
