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

          <h2 className="text-2xl mt-8 mb-4">4. Payments, Deposits, and Escrow</h2>
          <p>
            When a job is requested or a bid is accepted, customers are required to pay a <strong>deposit</strong> (a percentage of the agreed price, subject to a minimum). This deposit is processed securely and held by NEED on behalf of the Artisan (acting as an escrow agent, subject to regulatory approval) until the job is completed or cancelled.
          </p>
          <p className="mt-2">
            The deposit includes the platform service fee. NEED earns this fee for facilitating the connection.
          </p>

          <h2 className="text-2xl mt-8 mb-4">5. Non-Circumvention Policy</h2>
          <p>
            By using NEED, you agree not to arrange, request, or complete jobs originated on NEED outside the platform for a period of 12 months after the first introduction. 
          </p>
          <p className="mt-2">
            If you bypass the platform to avoid commission, NEED reserves the right to retain the platform fee from any held deposit, charge the fee to the artisan's wallet, recover it from future earnings, and issue strikes or permanently deactivate the offending accounts.
          </p>
          <p className="mt-2">
            Automated message screening is used to detect attempts to share contact details outside the platform before a deposit is paid.
          </p>

          <h2 className="text-2xl mt-8 mb-4">6. Cancellation and After-Arrival Policy</h2>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><strong>Before Technician is En Route:</strong> Customers can cancel for free if cancelled sufficiently in advance, with a full refund of the deposit.</li>
            <li><strong>After En Route, Before Arrival:</strong> A travel compensation fee will be deducted from the deposit and credited to the Artisan. The remainder is refunded.</li>
            <li><strong>After Arrival:</strong> The deposit is frozen and placed under review. A survey will be sent to determine the cause. If the Artisan could not fix the problem, a call-out fee is paid to the Artisan and the rest is refunded. If the Customer or Artisan attempted to bypass the platform after arrival, the platform fee will be retained as a circumvention fee.</li>
          </ul>

          <h2 className="text-2xl mt-8 mb-4">7. Location Sharing and Privacy</h2>
          <p>
            During an active job (from the time the Artisan is en route until completion), the Artisan's location is shared with NEED and the Customer to ensure safety and accurate arrival detection. By accepting a job, Artisans consent to this location sharing.
          </p>

          <h2 className="text-2xl mt-8 mb-4">8. Dispute Resolution</h2>
          <p>
            In the event of a dispute between a Customer and an Artisan, NEED provides a moderation platform to assist in resolution, but ultimately cannot be held liable for the actions, omissions, or damages caused by either party. NEED offers a limited Rework Guarantee for jobs completed on-platform and paid in full.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
