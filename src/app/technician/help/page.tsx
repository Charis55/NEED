import Link from "next/link";
import { HelpCircle, MessageSquare, ChevronDown } from "lucide-react";

export default function TechnicianHelpCenter() {
  const faqs = [
    {
      q: "How does the promotion work?",
      a: "As a new artisan, you keep 100% of your profits for your first 30 days! After the promotion ends, our standard 20% platform fee will apply."
    },
    {
      q: "When do I pay the platform fee?",
      a: "If the promo has ended, you'll need to pay the platform fee once you mark a job as 'payment_pending'. We accumulate these fees, and you can clear your balance from the Dashboard. If your oldest debt exceeds 7 days, your account will be restricted until paid."
    },
    {
      q: "How do I get the 'CERTIFIED' badge?",
      a: "Upload your trade certificate and police clearance from the Settings page. Our team reviews these documents within 24-48 hours. The badge increases customer trust and your visibility."
    },
    {
      q: "Can I decline a job?",
      a: "Yes, you can decline incoming jobs without penalty. However, once you 'Accept' a job, cancelling it later may negatively impact your rating."
    }
  ];

  return (
    <div className="w-full pt-16 px-6 md:px-12 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black min-h-[80vh]">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-4 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] mt-4">
        SUPPORT
      </h1>
      <p className="font-bold text-xl mb-8 uppercase max-w-2xl">Answers to common questions and direct support line.</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-black uppercase mb-4 flex items-center gap-2"><HelpCircle className="w-6 h-6 stroke-[3]" /> FAQs</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="bg-white brutal-border p-4 shadow-[4px_4px_0_0_#000] group cursor-pointer">
                <summary className="font-black uppercase text-lg flex justify-between items-center list-none">
                  {faq.q}
                  <ChevronDown className="w-5 h-5 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="mt-4 font-medium text-gray-700 leading-snug">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-black uppercase mb-4 flex items-center gap-2"><MessageSquare className="w-6 h-6 stroke-[3]" /> CONTACT SUPPORT</h2>
          <div className="bg-[var(--color-brutal-yellow)] p-8 brutal-border shadow-[8px_8px_0_0_#000]">
            <p className="font-bold text-lg mb-6 leading-tight">
              Have an issue with a customer, need help with a dispute, or have questions about your account? Contact us directly.
            </p>
            <Link 
              href="mailto:support@need.com"
              className="w-full bg-black text-white px-6 py-4 font-black uppercase brutal-border text-center hover:bg-white hover:text-black transition-colors block text-xl"
            >
              EMAIL SUPPORT
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
