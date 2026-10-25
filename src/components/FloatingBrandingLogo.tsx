"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface FloatingBrandingLogoProps {
  href: string;
}

export default function FloatingBrandingLogo({ href }: FloatingBrandingLogoProps) {
  const pathname = usePathname();

  // Hide floating branding logo on pages that have their own dedicated top navigation bar or back button
  // to avoid overlapping order IDs, titles, or back buttons.
  const isHidden = 
    pathname.includes("/jobs/") || 
    pathname.includes("/chat/") ||
    pathname.includes("/services/") ||
    pathname.includes("/track") ||
    pathname.includes("/navigate") ||
    pathname.includes("/performance") ||
    pathname.includes("/help") ||
    pathname.includes("/artisan/");

  if (isHidden) {
    return null;
  }

  return (
    <Link 
      href={href} 
      className="fixed top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-4 z-50 flex items-center bg-[var(--color-brutal-yellow)] border-4 border-black px-2 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform"
      aria-label="Need Home"
    >
      <img src="/LOGO.png" alt="N Logo" className="h-6 w-auto" />
      <span className="text-xl font-black text-black leading-none tracking-tighter -ml-0.5 mt-0.5">EED</span>
    </Link>
  );
}
