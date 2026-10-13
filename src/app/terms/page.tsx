import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service & Platform Policies | NEED Marketplace",
  description: "Comprehensive terms of service governing customer and technician interactions, escrow deposits, broadcast jobs, cancellations, and the 30-day workmanship guarantee on NEED.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-20">
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 bg-white inline-block px-4 py-2 brutal-border shadow-[4px_4px_0_0_#000]">
          Terms of Service
        </h1>
        <p className="text-sm font-black text-gray-700 uppercase tracking-widest mb-10">
          Official Legal Platform Policies & Escrow Regulations • Effective Date: October 2026
        </p>
        
        <div className="space-y-10 text-black leading-relaxed font-medium">
          
          {/* Section 1 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              1. Platform Nature & Acceptance of Terms
            </h2>
            <p className="mb-3">
              By accessing, browsing, registering for, or using the NEED mobile or web application (&ldquo;NEED&rdquo;, &ldquo;the Platform&rdquo;), you unequivocally agree to be bound by these Terms of Service. If you do not agree to these terms, you must discontinue use of the platform immediately.
            </p>
            <p>
              NEED acts solely as a technology intermediary connecting customers requiring trade services (including plumbing, electrical, carpentry, HVAC, masonry, and painting) with independent, vetted service professionals (&ldquo;Technicians&rdquo; or &ldquo;Artisans&rdquo;). NEED is not a direct employer, contractor, or joint venture partner of any Technician. Technicians operate as independent third-party contractors.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              2. Job Booking Workflows & Deferred Deposit Model
            </h2>
            <p className="mb-3">
              NEED provides two primary request models designed to facilitate fair, transparent matching:
            </p>
            <div className="space-y-4">
              <div className="bg-[var(--color-brutal-bg)] p-4 border-2 border-black">
                <h3 className="font-black uppercase text-base mb-1">A. Direct Technician Bookings</h3>
                <p className="text-sm">
                  When a customer books a specific technician from their profile or quote, the customer pays a <strong>25% commitment deposit</strong> upfront to lock in the appointment and secure the technician&apos;s time.
                </p>
              </div>

              <div className="bg-[var(--color-brutal-yellow)] p-4 border-2 border-black">
                <h3 className="font-black uppercase text-base mb-1">B. Community Broadcast Marketplace Requests (&ldquo;Post Job Anyway&rdquo;)</h3>
                <p className="text-sm">
                  When a customer posts a job to the open community marketplace (such as when seeking an immediate quote or when a preferred technician is unavailable), <strong>no upfront deposit is required to publish the request</strong>. The customer provides their description, attached photos/videos, and proposed budget.
                </p>
                <p className="text-sm mt-2 font-bold">
                  Upon acceptance by an artisan: When a qualified technician reviews and claims the broadcast job, the booking enters the <em>&ldquo;Awaiting Deposit&rdquo;</em> state. The customer is immediately prompted to pay the <strong>25% commitment deposit</strong> into platform escrow.
                </p>
                <p className="text-sm mt-2">
                  <strong>Technician Mobilization Constraint:</strong> Technicians are strictly instructed and contractual bound not to mobilize or travel until the 25% commitment deposit is confirmed as held in escrow.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              3. Payments, Escrow Mechanics, & Commission
            </h2>
            <p className="mb-3">
              To safeguard both customers and artisans against non-payment or unsatisfactory execution, NEED utilizes an escrow protection mechanism:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>25% Escrow Deposit:</strong> Paid via card, USSD, or verified bank transfer. These funds are held securely in escrow by NEED and are not released to the technician prior to job sign-off.
              </li>
              <li>
                <strong>75% Remaining Balance:</strong> Payable upon job completion. Customers may settle the balance directly via in-app card payment or cash-on-delivery.
              </li>
              <li>
                <strong>Release of Escrow:</strong> Escrowed funds are credited to the technician&apos;s wallet only after the customer confirms completion or after a 48-hour inspection period without an active dispute or rework claim.
              </li>
              <li>
                <strong>Platform Commission:</strong> NEED retains a platform fee (typically 15%–20%, subject to promotional discounts or repeat loyalty credits) to cover platform maintenance, insurance, customer support, and payment gateway costs.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              4. Technician Representations, Warranties, & Skill Affirmation
            </h2>
            <p className="mb-3">
              By registering as a Technician and especially by claiming an open broadcast job request:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Affirmation of Competence:</strong> The Technician legally warrants that they possess the necessary certifications, tools, physical capability, and expertise to perform the requested trade and subcategory to standard workmanship levels.
              </li>
              <li>
                <strong>Automatic Profile Skill Association:</strong> When a technician claims a broadcast request in a trade category, the platform links the skill to their verified profile history. Repeated unsatisfactory claims in a category will lead to revocation of that skill.
              </li>
              <li>
                <strong>Strict Liability for Workmanship:</strong> Technicians assume full legal liability for damages caused by their negligence, incorrect installation, or misconduct on the customer&apos;s premises.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              5. Cancellation, En Route Travel, & Refund Regulations
            </h2>
            <p className="mb-3">
              Cancellation policies balance customer flexibility with respect for technician time and transportation expenses:
            </p>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-gray-50 border-2 border-black">
                <p className="font-bold">A. Cancellation Before &ldquo;En Route&rdquo; Status:</p>
                <p>If a customer cancels before the technician marks themselves as &ldquo;En Route&rdquo;, the customer receives a <strong>100% full refund</strong> of their deposit immediately.</p>
              </div>

              <div className="p-3 bg-gray-50 border-2 border-black">
                <p className="font-bold">B. Cancellation After &ldquo;En Route&rdquo; Status:</p>
                <p>If a customer cancels while the technician is actively travelling, a standard travel compensation fee (₦1,500 – ₦3,000 depending on area) is deducted from the deposit and paid to the technician. The remaining deposit is refunded to the customer.</p>
              </div>

              <div className="p-3 bg-gray-50 border-2 border-black">
                <p className="font-bold">C. Cancellation After Arrival on Site:</p>
                <p>If the customer cancels after the technician has arrived on site, the deposit is frozen pending administrative review. If the cancellation was voluntary by the customer without fault from the technician, a call-out inspection fee is awarded to the technician.</p>
              </div>

              <div className="p-3 bg-green-50 border-2 border-black">
                <p className="font-bold text-green-900">D. Technician Cancellation or No-Show:</p>
                <p className="text-green-950">If an assigned technician cancels, is unresponsive, or fails to show up within a reasonable window of the preferred time, the customer receives an immediate <strong>100% refund</strong>, and the technician receives a disciplinary strike.</p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              6. NEED 30-Day Workmanship Guarantee
            </h2>
            <p className="mb-3">
              All jobs booked, deposited, and settled through NEED are backed by our <strong>30-Day Workmanship Guarantee</strong>:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>
                <strong>Eligibility:</strong> The job must have been booked and paid through NEED with an escrow deposit on record.
              </li>
              <li>
                <strong>Claim Process:</strong> If structural, mechanical, or installation defects arise within 30 days of completion, the customer can file a claim via their booking history with photos and description.
              </li>
              <li>
                <strong>Resolution:</strong> NEED will arrange a free redo by the technician, assign a replacement technician, or issue a platform credit refund.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              7. Non-Circumvention & Anti-Fraud Policy
            </h2>
            <p className="mb-3">
              The exchange of off-platform contact details (phone numbers, WhatsApp handles, bank accounts) prior to deposit confirmation is strictly prohibited by automated monitoring.
            </p>
            <p className="mb-3 text-sm">
              Users agree not to solicit or accept off-platform bookings for a period of 12 months following their introduction through NEED. Attempting to circumvent the platform to avoid fees voids all insurance, escrow protections, and warranties.
            </p>
            <p className="text-sm font-bold text-red-900 bg-red-50 p-3 border-2 border-black">
              Circumvention Penalty: In the event of confirmed circumvention, NEED reserves the right to deduct platform fees directly from held deposits, debit the technician&apos;s future earnings, and permanently ban offending accounts.
            </p>
          </section>

          {/* Section 8 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              8. Safety, GPS Tracking, & Emergency Protocols
            </h2>
            <p className="mb-3 text-sm">
              During active jobs where the technician is marked as &ldquo;En Route&rdquo;, real-time GPS coordinates are captured and displayed to the customer to enable accurate arrival forecasting. Both parties consent to this location tracking for safety purposes.
            </p>
            <p className="text-sm">
              NEED provides in-app SOS emergency triggers and voice call integration. In any event of imminent physical danger, users are urged to immediately contact local law enforcement authorities.
            </p>
          </section>

          {/* Section 9 */}
          <section className="bg-white brutal-border p-6 md:p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3 border-b-3 border-black pb-2">
              9. Contact & Legal Inquiries
            </h2>
            <p className="text-sm">
              For legal inquiries, dispute arbitration, or questions regarding escrow deposits and platform policies, contact our compliance team at <strong>legal@need.app</strong> or through in-app support.
            </p>
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
}
