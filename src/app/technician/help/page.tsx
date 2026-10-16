"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  HelpCircle, 
  MessageSquare, 
  ChevronDown, 
  Search, 
  ShieldCheck, 
  TrendingUp, 
  Briefcase, 
  AlertTriangle,
  Scale,
  Award,
  Copy,
  Check
} from "lucide-react";
import BackButton from "@/components/BackButton";

interface FAQItem {
  category: "Earnings & Wallet" | "Platform Fees & Promo" | "Managing Jobs" | "Compliance & Verification";
  q: string;
  a: string;
}

const TECHNICIAN_FAQS: FAQItem[] = [
  // Earnings & Wallet (5)
  {
    category: "Earnings & Wallet",
    q: "How and when do I get paid for completed jobs?",
    a: "Payment consists of two parts: the customer's 25% commitment deposit and the 75% final balance. The customer pays the remaining 75% directly to you upon satisfactory completion on site (via cash or bank transfer). The 25% escrow deposit is credited into your in-app wallet balance."
  },
  {
    category: "Earnings & Wallet",
    q: "When is the customer's 25% escrow deposit released into my wallet?",
    a: "The 25% commitment deposit held in escrow is released to your live wallet balance as soon as the job is marked completed and confirmed by the customer, or upon auto-confirmation after arrival inspection."
  },
  {
    category: "Earnings & Wallet",
    q: "How do I withdraw money from my wallet to my Nigerian bank account?",
    a: "Open your Technician Dashboard or Earnings page, tap the 'Withdraw' button on your Wallet Card, select your bank from our verified Nigerian banking list, input your 10-digit NUBAN account number, and confirm. Payouts are processed instantly via Paystack Direct Transfer."
  },
  {
    category: "Earnings & Wallet",
    q: "Are there withdrawal limits or fees for cashing out?",
    a: "To protect artisans from excessive banking charges, you are allocated up to 4 free withdrawals per calendar week. The minimum withdrawal amount is ₦100, and withdrawals are capped only by your available settled wallet balance."
  },
  {
    category: "Earnings & Wallet",
    q: "How can I top up / fund my account if I owe platform fees?",
    a: "Tap 'Fund Account' on your Wallet Card, enter the amount (minimum ₦100), and pay securely through Paystack with your card, USSD, or bank transfer. Your wallet balance is updated in real time."
  },

  // Platform Fees & Promo (5)
  {
    category: "Platform Fees & Promo",
    q: "How does the New Artisan 30-Day 0% Commission Promo work?",
    a: "Every new technician registered on NEED keeps 100% of their earnings with ZERO platform commission deducted for their first 30 days! Your remaining promo days are displayed prominently on your dashboard banner."
  },
  {
    category: "Platform Fees & Promo",
    q: "What is the standard platform commission once the promo ends?",
    a: "Once your 30-day trial concludes, NEED charges a modest platform fee on completed jobs to cover cloud infrastructure, continuous customer marketing, in-app calling, and escrow protection."
  },
  {
    category: "Platform Fees & Promo",
    q: "What is the Repeat Customer loyalty fee discount (15% -> 10% -> 6%)?",
    a: "When a customer re-hires you for repeat work, NEED discounts the commission rate automatically: Job 1 is charged at the standard tier, Job 2 drops to 10% (saving you money), and Job 3+ with the same customer drops to our VIP rate of just 6%."
  },
  {
    category: "Platform Fees & Promo",
    q: "When is the platform fee deducted?",
    a: "The fee is recorded when a job enters payment pending or completion. It is automatically settled against the 25% escrow deposit credited to your wallet. You never have to manually pay fees if your escrow deposit exceeds the commission."
  },
  {
    category: "Platform Fees & Promo",
    q: "What happens if my wallet balance becomes negative?",
    a: "If accumulated commissions exceed your wallet balance, your wallet reflects a negative balance. You have a 7-day grace period to clear the balance. If debt remains unpaid after 7 days, job dispatch is paused until your balance is funded."
  },

  // Managing Jobs & Navigation (5)
  {
    category: "Managing Jobs",
    q: "What is the difference between Direct Requests and Broadcast Alerts?",
    a: "Direct requests are sent specifically to you by a customer who chose your profile. Broadcast alerts are posted to all qualified technicians in your neighborhood; the first technician to review and accept the job secures the booking."
  },
  {
    category: "Managing Jobs",
    q: "Can I counter-offer if the customer's budget is too low?",
    a: "Yes! If the customer's job description or scope requires more labor or materials, tap 'Counter Offer' on the job card and propose your realistic price along with a polite explanation. The customer can accept your price or negotiate."
  },
  {
    category: "Managing Jobs",
    q: "How does live GPS navigation work when I head to a job?",
    a: "When you are ready to travel, tap 'START TRIP / EN ROUTE'. This activates turn-by-turn navigation on your device and shares your live travel progress with the customer so they are ready to welcome you."
  },
  {
    category: "Managing Jobs",
    q: "Can I decline jobs without getting penalized?",
    a: "Yes, you have full freedom to decline incoming pending jobs that do not fit your schedule or trade expertise without penalty. However, cancelling a job AFTER you have already accepted it damages your reliability score."
  },
  {
    category: "Managing Jobs",
    q: "What should I do if a customer requests to reschedule?",
    a: "If a customer requests a reschedule, a notice will appear on the job page with their proposed time. You can tap 'Accept New Time' to update the job calendar or 'Decline' if you are unavailable at that hour."
  },

  // Compliance & Verification (5)
  {
    category: "Compliance & Verification",
    q: "What is the strict 3-Strikes Anti-Circumvention Policy?",
    a: "To safeguard our marketplace and ensure all jobs are protected by escrow and insurance, taking platform customers off-app or negotiating off-platform is strictly forbidden: Strike 1 is a warning, Strike 2 reduces your search ranking by 40%, and Strike 3 results in a permanent ban and document blacklisting."
  },
  {
    category: "Compliance & Verification",
    q: "What happens if my account receives 3 strikes?",
    a: "At 3 strikes, your account is permanently deactivated, pending wallet payouts are frozen, and your verified government document or passport is blacklisted across the NEED platform to prevent duplicate signups."
  },
  {
    category: "Compliance & Verification",
    q: "How do I appeal an unfair strike?",
    a: "If you believe a strike was issued by mistake (e.g., an automated chat filter misunderstanding), navigate to Settings > Account Strikes, tap 'Appeal Strike', write your explanation, and attach evidence photos. An administrator reviews appeals within 48 hours."
  },
  {
    category: "Compliance & Verification",
    q: "How does Didit passport & government document KYC verification work?",
    a: "NEED uses Didit for automated identity and biometric verification. You simply take a photo of your International Passport, Driver's License, or Government ID card and a quick selfie. Our automated system validates your credentials securely in seconds."
  },
  {
    category: "Compliance & Verification",
    q: "How do I get the gold 'CERTIFIED' badge on my profile?",
    a: "Upload your trade certificates, vocational diplomas, or police character clearance under Settings > Verification. Once our quality assurance team validates your credentials, the verified 'CERTIFIED' badge is added to your profile, giving you top priority in customer search."
  }
];

export default function TechnicianHelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copied, setCopied] = useState(false);

  const categories = ["All", "Earnings & Wallet", "Platform Fees & Promo", "Managing Jobs", "Compliance & Verification"];

  const filteredFaqs = TECHNICIAN_FAQS.filter((faq) => {
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
          href="/technician/settings" 
          className="w-12 h-12 bg-white border-4 border-black text-black shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 transition-all rounded-none cursor-pointer flex items-center justify-center shrink-0" 
        />
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-600 block">Technician Knowledge Base</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-black tracking-tighter uppercase leading-none">
            SUPPORT & FAQS
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Search & Hero Card */}
        <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[6px_6px_0_0_#000]">
          <p className="font-black text-lg md:text-xl uppercase mb-4 text-black">
            Answers to technician questions on wallet payouts, escrow deposits, commissions, and job compliance:
          </p>
          <div className="relative">
            <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-black stroke-[3]" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search e.g. withdraw, escrow, promo, strikes, commission, Didit, certified..."
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
                <p className="text-xs font-bold text-gray-600 uppercase">Try searching another keyword or reset the filter.</p>
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
                Technician Support
              </h3>
              
              <p className="font-bold text-sm text-gray-900 leading-snug mb-6">
                Have a payment issue, dispute with a customer, need help with bank account linking, or appealing a strike? We are here for you.
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
                href="mailto:Momentumems@gmail.com?subject=NEED%20Technician%20Support%20Inquiry"
                className="w-full bg-black text-white px-5 py-4 font-black uppercase text-sm md:text-base border-3 border-black text-center hover:bg-white hover:text-black transition-all block shadow-[3px_3px_0_0_#000] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              >
                EMAIL SUPPORT NOW →
              </Link>

              <div className="mt-6 pt-4 border-t-2 border-black space-y-2 text-xs font-bold text-gray-800">
                <p className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-green-700 shrink-0" />
                  <span>Prompt payouts & wallet protection</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-black shrink-0" />
                  <span>Fair due process & strike appeal desk</span>
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
