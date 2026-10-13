import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import { Mail, MapPin, Clock, Phone, MessageSquare, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us & Customer Support | NEED Marketplace",
  description: "Get in touch with NEED Marketplace support. We provide 24/7 customer dispute assistance, business partnerships, and technician verification support.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 md:py-20">
        <div className="max-w-2xl mb-12">
          <span className="bg-[var(--color-brutal-yellow)] px-3 py-1 text-xs font-black uppercase tracking-widest brutal-border inline-block mb-3">
            Customer Support & Inquiries
          </span>
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-4">
            Contact NEED Operations
          </h1>
          <p className="text-base sm:text-xl font-bold text-gray-700">
            Have a question about a booking, artisan verification, or platform escrow? Our team is active 7 days a week.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Support Card */}
          <div className="bg-white p-8 border-4 border-black shadow-[6px_6px_0_0_#000] flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 bg-[var(--color-brutal-pink)] border-2 border-black flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Customer Care</h3>
              <p className="text-xs font-bold text-gray-600 mb-4">
                For active booking inquiries, dispute reviews, and refund questions:
              </p>
            </div>
            <a
              href="mailto:support@needmarketplace.com"
              className="font-black text-sm bg-black text-white p-3 border-2 border-black text-center block hover:bg-[var(--color-brutal-yellow)] hover:text-black transition-colors"
            >
              support@needmarketplace.com
            </a>
          </div>

          {/* Business & Press Card */}
          <div className="bg-white p-8 border-4 border-black shadow-[6px_6px_0_0_#000] flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 bg-[var(--color-brutal-yellow)] border-2 border-black flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Corporate & Press</h3>
              <p className="text-xs font-bold text-gray-600 mb-4">
                For enterprise facility partnerships, vendor onboarding, and press:
              </p>
            </div>
            <a
              href="mailto:hello@needmarketplace.com"
              className="font-black text-sm bg-black text-white p-3 border-2 border-black text-center block hover:bg-[var(--color-brutal-teal)] hover:text-black transition-colors"
            >
              hello@needmarketplace.com
            </a>
          </div>

          {/* Operating Hours Card */}
          <div className="bg-white p-8 border-4 border-black shadow-[6px_6px_0_0_#000] flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 bg-[var(--color-brutal-teal)] border-2 border-black flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Hours of Operation</h3>
              <p className="text-xs font-bold text-gray-600 mb-2">
                Emergency Dispatch: <strong>24/7 Online</strong>
              </p>
              <p className="text-xs font-bold text-gray-600">
                Support Desk: <strong>Monday – Sunday, 7:00 AM – 10:00 PM (WAT)</strong>
              </p>
            </div>
            <div className="text-xs font-black bg-gray-100 p-2 border-2 border-black text-center">
              Average Response: &lt; 2 Hours
            </div>
          </div>
        </div>

        {/* Operating Hub / Headquarters */}
        <div className="bg-white p-8 sm:p-12 border-4 border-black shadow-[8px_8px_0_0_#000] space-y-6">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-[var(--color-brutal-red)]" />
            <h2 className="text-2xl font-black uppercase tracking-tight">
              Headquarters & Regional Operations
            </h2>
          </div>
          <p className="text-sm font-semibold text-gray-700 leading-relaxed max-w-3xl">
            NEED Marketplace operates across major commercial hubs in Nigeria including Lagos (Ikeja, Lekki, Yaba, Surulere, Victoria Island) and Abuja, connecting certified local technicians with residential and commercial properties.
          </p>
          <div className="border-t-2 border-black pt-4 flex flex-wrap gap-4 text-xs font-bold text-gray-600">
            <span>• RC / Business Registration Compliant</span>
            <span>• Secure Licensed Payment Processing</span>
            <span>• Strict Technician Police Clearance Verification</span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
