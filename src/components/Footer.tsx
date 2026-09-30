"use client";

import Link from "next/link";
import { useState } from "react";
import TermsDisclaimer from "@/components/TermsDisclaimer";

export default function Footer() {
  const [showTerms, setShowTerms] = useState(false);

  return (
    <footer className="bg-black text-white py-12 border-t-8 border-black">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center mb-4">
            <span className="text-[36px] font-bold leading-none tracking-tighter text-[var(--color-brutal-yellow)]">NEED</span>
          </div>
          <p className="text-gray-400 text-sm font-medium leading-relaxed">
            The raw way to hire trusted technicians. Find verified plumbers, electricians, and more in your neighborhood instantly.
          </p>
        </div>
        
        <div>
          <h4 className="text-xl font-black uppercase mb-4 tracking-widest text-[var(--color-brutal-teal)]">Company</h4>
          <ul className="space-y-2 font-bold">
            <li><Link href="/about" className="hover:text-[var(--color-brutal-pink)] transition-colors">About Us</Link></li>
            <li><Link href="/blog" className="hover:text-[var(--color-brutal-pink)] transition-colors">Blog & Articles</Link></li>
            <li><Link href="/contact" className="hover:text-[var(--color-brutal-pink)] transition-colors">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xl font-black uppercase mb-4 tracking-widest text-[var(--color-brutal-teal)]">Legal</h4>
          <ul className="space-y-2 font-bold">
            <li>
              <button 
                onClick={() => setShowTerms(true)} 
                className="hover:text-[var(--color-brutal-pink)] transition-colors text-left"
              >
                Terms of Service
              </button>
            </li>
            <li>
              <button 
                onClick={() => setShowTerms(true)} 
                className="hover:text-[var(--color-brutal-pink)] transition-colors text-left"
              >
                Privacy Policy
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xl font-black uppercase mb-4 tracking-widest text-[var(--color-brutal-teal)]">Get Started</h4>
          <ul className="space-y-2 font-bold">
            <li><Link href="/login?mode=signup&role=customer" className="hover:text-[var(--color-brutal-yellow)] transition-colors">Sign up as Customer</Link></li>
            <li><Link href="/login?mode=signup&role=artisan" className="hover:text-[var(--color-brutal-yellow)] transition-colors">Join as Technician</Link></li>
          </ul>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mt-12 pt-8 border-t-2 border-gray-800 text-center text-gray-500 text-sm font-bold uppercase tracking-widest">
        &copy; {new Date().getFullYear()} NEED App. All rights reserved.
      </div>
      
      {showTerms && (
        <TermsDisclaimer 
          role="customer" 
          onClose={() => setShowTerms(false)} 
        />
      )}
    </footer>
  );
}
