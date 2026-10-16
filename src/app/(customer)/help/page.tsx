"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  HelpCircle, 
  MessageSquare, 
  ChevronDown, 
  Search, 
  ShieldCheck, 
  Lock, 
  CreditCard, 
  Briefcase, 
  PhoneCall, 
  Award,
  Mail,
  Copy,
  Check
} from "lucide-react";
import BackButton from "@/components/BackButton";

interface FAQItem {
  category: "Escrow & Payments" | "Booking & Managing" | "Safety & Calls" | "Guarantee & Trust";
  q: string;
  a: string;
}

const CUSTOMER_FAQS: FAQItem[] = [
  // Escrow & Payments (6)
  {
    category: "Escrow & Payments",
    q: "What is the 25% commitment deposit and how does escrow protect me?",
    a: "When a technician accepts your request, you pay a 25% commitment deposit online via Paystack. This deposit is NOT immediately handed to the technician; it is locked safely in NEED's regulated escrow vault. This guarantees that your artisan is committed to arriving, while protecting your money until you verify and approve the work completed on site."
  },
  {
    category: "Escrow & Payments",
    q: "When and how do I pay the remaining 75% balance?",
    a: "The remaining 75% balance is only paid once the technician has arrived, completed the job to your satisfaction, and you have physically inspected the results. You can settle the balance in cash directly with the technician or through your agreed payment method on site."
  },
  {
    category: "Escrow & Payments",
    q: "Is my money safe if the technician cancels or fails to show up?",
    a: "Yes, 100%. If a technician cancels after accepting or does not arrive at your scheduled address, your 25% escrow deposit is automatically restored or refunded to you immediately. The technician is also penalized on their reliability score."
  },
  {
    category: "Escrow & Payments",
    q: "What happens if there is a pricing dispute with the technician on site?",
    a: "Your initial agreed price is binding. If unforeseen complications arise requiring extra materials or labor, the technician must submit an official counter-offer or revision through the app. Never pay extra cash off-platform; having adjustments logged in NEED ensures they are covered under our 30-Day Guarantee."
  },
  {
    category: "Escrow & Payments",
    q: "What payment methods are supported for escrow deposits?",
    a: "We support all major Nigerian payment channels through Paystack, including Mastercard, Visa, Verve debit cards, direct Bank Transfers, USSD, and Apple Pay."
  },
  {
    category: "Escrow & Payments",
    q: "Can I use platform loyalty credits to pay for my deposit?",
    a: "Yes! If you have accumulated loyalty credits from previous in-app payments, referral bonuses, or platform surveys, they are automatically applied at checkout to discount or fully cover your 25% commitment deposit."
  },

  // Booking & Managing (6)
  {
    category: "Booking & Managing",
    q: "What is the difference between a Direct Request and a Broadcast Request?",
    a: "A Direct Request is sent directly to an artisan of your choice whose profile, portfolio, and reviews you liked. A Broadcast Request broadcasts your job to all qualified, nearby artisans in your trade category simultaneously, allowing the fastest available technician to respond and accept."
  },
  {
    category: "Booking & Managing",
    q: "How do price negotiations and counter-offers work?",
    a: "When requesting a job, you propose your starting offer. The technician can accept your price directly or propose a Counter Offer with a brief explanation. You can review their counter price and choose to Accept, Counter back with a revised figure, or Decline with no obligation."
  },
  {
    category: "Booking & Managing",
    q: "How do I track the technician live on GPS?",
    a: "Once a technician marks their status as 'En Route', a live 'Track Live GPS' button appears on your booking page. You can follow their real-time location on an interactive map as they travel to your home or office."
  },
  {
    category: "Booking & Managing",
    q: "Can I reschedule a job if my schedule changes?",
    a: "Yes. From your booking details screen, tap 'Request a Reschedule' to propose a new date and time. The technician will receive an instant notification to confirm or negotiate the new schedule."
  },
  {
    category: "Booking & Managing",
    q: "How do I cancel a booking and what is the policy?",
    a: "You can cancel any booking before the technician sets out. If cancelled before the technician is en route, your deposit is fully credited back. Excessive cancellations without valid cause may result in automated account restrictions."
  },
  {
    category: "Booking & Managing",
    q: "What should I do once the technician finishes the job?",
    a: "Inspect the completed workmanship thoroughly. Once satisfied, confirm completion in the app and pay the remaining 75% balance. You will then be prompted to rate and review the technician to help other customers."
  },

  // Safety & Calls (4)
  {
    category: "Safety & Calls",
    q: "How do in-app voice and video calls work?",
    a: "NEED features built-in encrypted voice and video calling. Once a job is confirmed, you can call your technician directly through the app without paying carrier phone charges or revealing your personal phone number."
  },
  {
    category: "Safety & Calls",
    q: "Is my personal phone number or private address shared publicly?",
    a: "Never. Your personal contact number and private home coordinates are masked and protected. The technician only receives your service address and neighborhood once the booking is confirmed with an escrow deposit."
  },
  {
    category: "Safety & Calls",
    q: "Why is taking transactions or communications off-platform prohibited?",
    a: "Conducting jobs off-platform strips away all customer protections, including our Escrow vault, identity vetting, in-app location tracking, and 30-Day Workmanship Guarantee. Both customers and technicians who circumvent the platform are subject to account bans."
  },
  {
    category: "Safety & Calls",
    q: "What is the Panic Button and how does it protect me?",
    a: "During an active in-progress job, a high-priority emergency button is accessible on your booking screen. Tapping it instantly triggers an alert to our 24/7 Trust & Safety dispatch team with your GPS coordinates and technician identity."
  },

  // Guarantee & Trust (4)
  {
    category: "Guarantee & Trust",
    q: "What is the NEED 30-Day Workmanship Guarantee?",
    a: "Every job booked and paid through the NEED platform is backed by our 30-Day Workmanship Guarantee. If a fault, leak, structural defect, or workmanship flaw occurs within 30 days of job completion, we arrange a free rework or credit refund."
  },
  {
    category: "Guarantee & Trust",
    q: "How do I file a 30-Day Guarantee claim?",
    a: "Navigate to your completed job receipt or booking page and click 'Claim Guarantee'. Attach photos or videos showing the issue and a brief description. Our quality audit team reviews claims within 24 hours."
  },
  {
    category: "Guarantee & Trust",
    q: "How are technicians vetted and what does the 'CERTIFIED' badge mean?",
    a: "All technicians must pass government biometric KYC verification (Didit passport or government ID document verification). Technicians who display the gold 'CERTIFIED' badge have also had their trade qualifications and background clearances manually verified."
  },
  {
    category: "Guarantee & Trust",
    q: "How do customer reviews work and can technicians delete negative reviews?",
    a: "No technician or customer can alter or delete verified reviews. Ratings and comments can only be submitted by verified customers who completed and paid for an actual job on the platform."
  }
];

export default function CustomerHelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copied, setCopied] = useState(false);

  const categories = ["All", "Escrow & Payments", "Booking & Managing", "Safety & Calls", "Guarantee & Trust"];

  const filteredFaqs = CUSTOMER_FAQS.filter((faq) => {
    const matchesCategory = selectedCategory === "All" || faq.category === selectedCategory;
    const matchesSearch = 
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      faq.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("Momentumems@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full pt-12 px-4 sm:px-6 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black min-h-screen bg-[var(--color-brutal-bg)] font-sans">
      
      {/* Top Navigation Bar with Back Button */}
      <div className="max-w-6xl mx-auto mb-6 flex items-center gap-3">
        <BackButton 
          href="/settings" 
          className="w-12 h-12 bg-white border-4 border-black text-black shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 transition-all rounded-none cursor-pointer flex items-center justify-center shrink-0" 
        />
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-600 block">Support & FAQs</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black tracking-tighter uppercase leading-none">
            HELP CENTER
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Search & Hero Card */}
        <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[6px_6px_0_0_#000]">
          <p className="font-black text-lg md:text-xl uppercase mb-4 text-black">
            Have questions about escrow, payments, or bookings? Search our verified customer guide below:
          </p>
          <div className="relative">
            <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-black stroke-[3]" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search e.g. escrow, deposit, refund, cancel, call, guarantee..."
              className="w-full pl-13 pr-4 py-4 border-4 border-black font-bold text-base md:text-lg focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors placeholder:text-gray-500 placeholder:font-normal"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t-3 border-black">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
                  selectedCategory === cat 
                    ? "bg-black text-white shadow-[2px_2px_0_0_#000] -translate-y-0.5" 
                    : "bg-gray-100 text-black hover:bg-[var(--color-brutal-yellow)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content Layout: FAQs (Left) & Direct Support Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* FAQ Accordion List (2 Cols on Desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-4 border-black">
              <h2 className="text-2xl font-black uppercase flex items-center gap-2 text-black">
                <HelpCircle className="w-7 h-7 stroke-[3] text-[var(--color-brutal-green)]" />
                <span>Frequently Asked Questions ({filteredFaqs.length})</span>
              </h2>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="bg-white border-4 border-black p-8 text-center shadow-[4px_4px_0_0_#000]">
                <p className="font-black text-lg uppercase text-gray-500 mb-2">No matching questions found.</p>
                <p className="text-xs font-bold text-gray-600 uppercase">Try searching another keyword or clear your search query.</p>
                <button 
                  onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
                  className="mt-4 px-4 py-2 bg-[var(--color-brutal-yellow)] border-2 border-black font-black uppercase text-xs"
                >
                  Reset Search
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq, idx) => (
                  <details 
                    key={idx} 
                    className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] group cursor-pointer transition-all open:shadow-[6px_6px_0_0_#000] open:bg-amber-50/40"
                  >
                    <summary className="font-black uppercase text-base md:text-lg flex justify-between items-start list-none gap-3 text-black">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xs font-black px-2 py-0.5 bg-[var(--color-brutal-yellow)] border border-black shrink-0 mt-0.5">
                          #{idx + 1}
                        </span>
                        <span>{faq.q}</span>
                      </div>
                      <ChevronDown className="w-6 h-6 stroke-[3] group-open:rotate-180 transition-transform shrink-0 mt-0.5 text-black" />
                    </summary>
                    <div className="mt-3 pt-3 border-t-2 border-black/20 pl-8">
                      <p className="font-bold text-gray-800 text-sm md:text-base leading-relaxed">
                        {faq.a}
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-black uppercase bg-gray-200 px-2 py-0.5 border border-black text-gray-700">
                        {faq.category}
                      </span>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* Contact Support Sidebar Card */}
          <div className="space-y-6">
            <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-6 md:p-7 shadow-[6px_6px_0_0_#000] sticky top-24">
              <div className="w-12 h-12 bg-white border-3 border-black flex items-center justify-center mb-4 shadow-[3px_3px_0_0_#000]">
                <MessageSquare className="w-7 h-7 stroke-[3] text-black" />
              </div>

              <h3 className="text-2xl font-black uppercase text-black tracking-tight mb-2">
                Need Help Fast?
              </h3>
              
              <p className="font-bold text-sm text-gray-900 leading-snug mb-6">
                Our customer resolution desk is available 24/7 to resolve disputes, review escrow deposits, or assist with your bookings.
              </p>

              {/* Verified Support Email Box */}
              <div className="bg-white border-3 border-black p-4 mb-4 shadow-[3px_3px_0_0_#000]">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-1">
                  Official Support Email
                </span>
                <p className="font-black text-sm md:text-base text-black break-all select-all">
                  Momentumems@gmail.com
                </p>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="mt-2 text-xs font-black uppercase text-blue-700 hover:text-black flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied to Clipboard!" : "Copy Email"}</span>
                </button>
              </div>

              <Link 
                href="mailto:Momentumems@gmail.com?subject=NEED%20Customer%20Support%20Inquiry"
                className="w-full bg-black text-white px-5 py-4 font-black uppercase text-sm md:text-base border-3 border-black text-center hover:bg-white hover:text-black transition-all block shadow-[3px_3px_0_0_#000] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              >
                EMAIL SUPPORT NOW →
              </Link>

              <div className="mt-6 pt-4 border-t-2 border-black space-y-2 text-xs font-bold text-gray-800">
                <p className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-green-700 shrink-0" />
                  <span>30-Day Workmanship Guarantee covered</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-black shrink-0" />
                  <span>25% commitment escrow vault protected</span>
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
