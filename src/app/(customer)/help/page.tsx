import Link from "next/link";
import { HelpCircle, MessageSquare, ChevronDown } from "lucide-react";

export default function HelpCenter() {
  const faqs = [
    {
      q: "How do I pay for a service?",
      a: "Currently, you pay the technician directly once the job is completed. Soon, we will introduce seamless in-app payments!"
    },
    {
      q: "What if the technician doesn't show up?",
      a: "You can report the job from your Bookings page. We take reliability seriously and penalize no-shows."
    },
    {
      q: "How are technicians verified?",
      a: "We verify their identity, and optionally their trade certificates and police clearance. Look for the 'CERTIFIED' badge on their profile."
    },
    {
      q: "Can I cancel a request?",
      a: "Yes, you can cancel a pending or accepted request from your Bookings page. Excessive cancellations may affect your account standing."
    }
  ];

  return (
    <div className="w-full pt-16 px-6 md:px-12 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black min-h-[80vh]">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-4 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] mt-4">
        HELP CENTER
      </h1>
      <p className="font-bold text-xl mb-8 uppercase max-w-2xl">Find answers or get in touch with our support team.</p>

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
              Can't find what you're looking for? Our trust & safety team is here to help you resolve any issues.
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
