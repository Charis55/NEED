import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-20">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 bg-[var(--color-brutal-teal)] inline-block px-4 py-2 brutal-border">
          Privacy Policy
        </h1>
        
        <div className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-p:font-medium">
          <p className="text-gray-600 mb-8 font-bold">Last Updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-2xl mt-8 mb-4">1. Information We Collect</h2>
          <p>
            When you register for an account on NEED, we collect personal information such as your name, email address, phone number, and location data. For Artisans, we also collect identification documents for verification purposes.
          </p>

          <h2 className="text-2xl mt-8 mb-4">2. How We Use Your Information</h2>
          <p>
            We use the information we collect to operate, maintain, and improve our platform. This includes connecting customers with artisans, processing payments, sending transactional emails, and improving our matching algorithms.
          </p>

          <h2 className="text-2xl mt-8 mb-4">3. Data Sharing and Disclosure</h2>
          <p>
            We do not sell your personal information to third parties. We may share your information with trusted third-party service providers (like payment processors and email providers) solely for the purpose of operating the platform.
          </p>

          <h2 className="text-2xl mt-8 mb-4">4. Security of Your Data</h2>
          <p>
            We take reasonable measures to protect your personal information from unauthorized access, use, or disclosure. However, no method of transmission over the Internet or electronic storage is 100% secure.
          </p>

          <h2 className="text-2xl mt-8 mb-4">5. Contact Us</h2>
          <p>
            If you have any questions or concerns regarding this Privacy Policy, please contact us at support@needapp.com.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
