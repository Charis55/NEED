import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | NEED Marketplace",
  description: "Official Privacy Policy of NEED Marketplace, including data collection, user rights, Google AdSense, and cookie disclosures.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-20">
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 bg-[var(--color-brutal-teal)] inline-block px-4 py-2 brutal-border">
          Privacy Policy
        </h1>
        <p className="text-sm font-bold text-gray-600 mb-8">
          Last Updated: October 13, 2026 | Effective Date: January 1, 2026
        </p>

        <div className="bg-white p-8 md:p-12 brutal-border shadow-[6px_6px_0_0_#000] space-y-8 text-sm md:text-base leading-relaxed font-medium">
          <section className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              1. Introduction & Overview
            </h2>
            <p>
              NEED Marketplace ("NEED", "we", "our", or "us") operates the website{" "}
              <strong>https://need-chi.vercel.app</strong> and associated mobile services connecting customers with independent skilled artisans and home service professionals. We are committed to safeguarding your privacy and ensuring transparency in all data collection, advertising, and processing activities.
            </p>
            <p>
              This Privacy Policy explains how we collect, store, utilize, and protect your personal information, as well as your choices regarding cookies and personalized online advertising in compliance with the Nigeria Data Protection Act (NDPA), GDPR guidelines, and applicable international privacy standards.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              2. Information We Collect
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account & Profile Information:</strong> Full name, telephone number, email address, physical neighborhood, and profile avatar provided during customer or technician registration.
              </li>
              <li>
                <strong>Technician Verification Data:</strong> Government-issued National Identification Number (NIN), trade certifications, and background verification records required to vet technicians.
              </li>
              <li>
                <strong>Job & Transaction Records:</strong> Service requests, agreed pricing, escrow deposits, timestamps, customer reviews, and ratings.
              </li>
              <li>
                <strong>Geolocation Data:</strong> Approximate coordinates for neighborhood matching, and precise real-time GPS tracking of technicians exclusively while an active service job is marked as <em>en_route</em> or <em>in_progress</em>.
              </li>
              <li>
                <strong>Log Files & Technical Data:</strong> Internet Protocol (IP) addresses, browser type, device identifiers, referring/exit pages, operating system, and date/time stamps.
              </li>
            </ul>
          </section>

          {/* MANDATORY GOOGLE ADSENSE & COOKIE DISCLOSURE */}
          <section className="space-y-3 bg-amber-50 p-6 border-2 border-black">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              3. Google AdSense & Third-Party Advertising Disclosures
            </h2>
            <p>
              We partner with third-party advertising networks, including <strong>Google AdSense</strong>, to display relevant advertisements on our website. To maintain compliance with Google's advertising policies:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Use of Cookies:</strong> Third-party vendors, including Google, use cookies (such as the DoubleClick cookie) to serve advertisements based on a user's prior visits to our website or other websites across the Internet.
              </li>
              <li>
                <strong>Personalized Advertising:</strong> Google's use of advertising cookies enables it and its partners to serve targeted ads to users based on their navigation history on NEED and other sites.
              </li>
              <li>
                <strong>Opt-Out Options:</strong> Users can easily opt out of personalized advertising at any time by visiting{" "}
                <a
                  href="https://www.google.com/settings/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-black underline text-blue-700 hover:text-black"
                >
                  Google Ads Settings (https://www.google.com/settings/ads)
                </a>
                .
              </li>
              <li>
                Alternatively, you may opt out of third-party vendor use of cookies for personalized advertising by visiting the Digital Advertising Alliance opt-out portal at{" "}
                <a
                  href="https://www.aboutads.info/choices/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-black underline text-blue-700 hover:text-black"
                >
                  www.aboutads.info/choices/
                </a>
                .
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              4. Cookies and Web Beacons
            </h2>
            <p>
              A cookie is a small file placed on your device to enable core website functionality, remember preferences, and analyze site traffic. We use:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Strictly Necessary Cookies:</strong> Essential for user authentication, security sessions, and escrow payment workflows.
              </li>
              <li>
                <strong>Performance & Analytics Cookies:</strong> Anonymous telemetry (such as Vercel Web Analytics and Speed Insights) to evaluate page load speeds and error rates.
              </li>
              <li>
                <strong>Advertising Cookies:</strong> Deployed by Google AdSense and marketing partners to measure ad performance and display relevant promotions.
              </li>
            </ul>
            <p>
              You can control or disable cookies via your browser settings. However, disabling essential cookies may impact certain marketplace features like real-time booking and interactive chat.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              5. How We Protect and Share Information
            </h2>
            <p>
              We implement industry-standard encryption, strict database security rules, and server-side authorization checks to protect all stored information. We never sell, rent, or trade your personal contact details to external brokers.
            </p>
            <p>
              Information is only shared under the following conditions:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Between Job Counterparties:</strong> Counterparty details are shared exclusively after a job is confirmed and escrow deposit is secured.
              </li>
              <li>
                <strong>Licensed Payment Providers:</strong> Financial details are tokenized and processed securely via licensed CBN-regulated payment gateways (Paystack).
              </li>
              <li>
                <strong>Legal & Regulatory Compliance:</strong> When required by Nigerian law, court orders, or law enforcement investigations.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              6. Your Data Rights & Choices
            </h2>
            <p>
              Depending on your jurisdiction, you possess the following rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The right to request access to the personal data we hold about you.</li>
              <li>The right to rectify inaccurate or incomplete profile records.</li>
              <li>The right to request account deletion and removal of personal data.</li>
              <li>The right to object to or restrict certain automated data processing.</li>
            </ul>
            <p>
              To exercise any of these rights, please contact our Data Protection Officer at{" "}
              <a href="mailto:privacy@needmarketplace.com" className="font-bold underline text-blue-700">
                privacy@needmarketplace.com
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              7. Children's Privacy
            </h2>
            <p>
              NEED Marketplace is strictly intended for individuals aged 18 and older. We do not knowingly collect or solicit personal information from children under the age of 18. If we discover that a minor has provided us with personal information, we immediately delete such records.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              8. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy periodically to reflect enhancements to our service, security practices, or legal requirements. Any modifications will be posted directly to this page with an updated "Last Updated" date.
            </p>
          </section>

          <section className="space-y-3 bg-gray-50 p-6 border-2 border-black">
            <h2 className="text-xl md:text-2xl font-black uppercase border-b-2 border-black pb-2 text-black">
              9. Contact Our Privacy Team
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our advertising practices, please contact us:
            </p>
            <div className="font-bold text-xs md:text-sm space-y-1">
              <p>NEED Marketplace Operations</p>
              <p>Email: <a href="mailto:privacy@needmarketplace.com" className="underline text-blue-700">privacy@needmarketplace.com</a></p>
              <p>General Support: <a href="mailto:support@needmarketplace.com" className="underline text-blue-700">support@needmarketplace.com</a></p>
              <p>Headquarters: Lagos, Nigeria</p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
