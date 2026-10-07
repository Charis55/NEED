"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PublicHeader() {
  const router = useRouter();

  return (
    <nav className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full py-8 flex justify-between items-center bg-[var(--color-brutal-bg)]">
      <Link href="/" className="flex items-center gap-3">
        <div className="flex items-center">
          {/* ADJUST LOGO ALIGNMENT HERE: Change translate-y-[-2px] to move the 'N' up or down */}
          <img src="/LOGO.png" alt="N Logo" className="h-12 w-auto transform translate-y-[-2px]" />
          <span className="text-[44px] font-bold text-black leading-none tracking-tighter -ml-2">EED</span>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()} 
          className="hidden sm:flex items-center font-black uppercase text-black hover:text-[var(--color-brutal-teal)] tracking-widest transition-colors mr-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2 stroke-[3]" />
          Go Back
        </button>
        <Link href="/login?mode=signin" className="bg-[var(--color-brutal-yellow)] px-8 py-3 text-lg brutal-btn">
          Sign In
        </Link>
      </div>
    </nav>
  );
}
