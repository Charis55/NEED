import { ReactNode } from "react";
import Link from "next/link";
import ArtisanDock from "@/components/ArtisanDock";

export default function ArtisanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 relative">
      {/* Branding Logo (Floating) */}
      <Link href="/technician/dashboard" className="fixed top-4 left-4 z-50 flex items-center bg-[var(--color-brutal-yellow)] border-4 border-black px-2 py-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
        <img src="/LOGO.png" alt="N Logo" className="h-6 w-auto" />
        <span className="text-xl font-black text-black leading-none tracking-tighter -ml-0.5 mt-0.5">EED</span>
      </Link>

      <main className="w-full">
        {children}
      </main>
      
      <ArtisanDock />
    </div>
  );
}
