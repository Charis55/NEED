import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 md:py-20">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 bg-white inline-block px-4 py-2 brutal-border">
          Terms of Service
        </h1>
        
        <div className="prose prose-lg max-w-none prose-headings:font-black prose-headings:uppercase prose-p:font-medium">
          <p className="text-gray-600 mb-8 font-bold">Last Updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-2xl mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing and using the NEED application ("the App"), you accept and agree to be bound by the terms and provision of this agreement.
          </p>

          <h2 className="text-2xl mt-8 mb-4">2. Description of Service</h2>
          <p>
            NEED is a platform that connects customers seeking various services (such as plumbing, electrical work, carpentry) with independent technicians ("Artisans") who provide such services. NEED does not directly provide these services and is not an employer of the Artisans.
          </p>

          <h2 className="text-2xl mt-8 mb-4">3. User Conduct and Responsibilities</h2>
          <p>
            Users agree to use the platform for lawful purposes only. Customers agree to provide accurate information when requesting a job. Artisans agree to maintain valid licenses and accurately represent their skills and qualifications.
          </p>

          <h2 className="text-2xl mt-8 mb-4">4. Payments and Fees</h2>
          <p>
            All payments are processed securely. NEED may charge a service fee for facilitating the transaction. Users agree to pay all applicable fees associated with the services rendered by Artisans.
          </p>

          <h2 className="text-2xl mt-8 mb-4">5. Dispute Resolution</h2>
          <p>
            In the event of a dispute between a Customer and an Artisan, NEED provides a moderation platform to assist in resolution, but ultimately cannot be held liable for the actions, omissions, or damages caused by either party.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
