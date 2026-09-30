import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-20 text-center">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 bg-[var(--color-brutal-yellow)] inline-block px-4 py-2 brutal-border">
          Contact Us
        </h1>
        
        <div className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase mx-auto">
          <p className="text-2xl font-bold mb-8">
            Need help? We're here for you.
          </p>

          <div className="bg-white p-8 brutal-card inline-block text-left">
            <h2 className="text-3xl mb-4 text-[var(--color-brutal-teal)]">Support</h2>
            <p className="font-medium text-lg mb-4">
              For any issues regarding your account, job requests, or disputes, please reach out to our dedicated support team:
            </p>
            <p className="text-2xl sm:text-lg md:text-2xl font-black bg-[var(--color-brutal-pink)] inline-block px-4 py-2 brutal-border break-all">
              support@needmarketplace.com
            </p>

            <h2 className="text-3xl mt-12 mb-4 text-[var(--color-brutal-teal)]">Business Inquiries</h2>
            <p className="font-medium text-lg mb-4">
              For partnerships, press, or investment inquiries:
            </p>
            <p className="text-2xl sm:text-lg md:text-2xl font-black bg-[var(--color-brutal-yellow)] inline-block px-4 py-2 brutal-border break-all">
              hello@needmarketplace.com
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
