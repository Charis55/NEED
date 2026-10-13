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
      <div className="flex items-center gap-4 sm:gap-6">
        <Link
          href="/explore"
          className="hidden md:inline-block font-black uppercase text-sm tracking-wider hover:text-[var(--color-brutal-teal)] transition-colors"
        >
          Explore Trades
        </Link>
        <Link
          href="/blog"
          className="hidden sm:inline-block font-black uppercase text-sm tracking-wider hover:text-[var(--color-brutal-teal)] transition-colors"
        >
          Guides
        </Link>
        <Link
          href="/about"
          className="hidden sm:inline-block font-black uppercase text-sm tracking-wider hover:text-[var(--color-brutal-teal)] transition-colors"
        >
          About
        </Link>
        <Link href="/login?mode=signin" className="bg-[var(--color-brutal-yellow)] px-6 py-2.5 text-base font-black uppercase brutal-btn">
          Sign In
        </Link>
      </div>
    </nav>
  );
}
