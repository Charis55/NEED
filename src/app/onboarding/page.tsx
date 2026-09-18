import ArtisanOnboarding from "@/components/ArtisanOnboarding";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8 text-center relative z-10">
        <Link href="/" className="flex items-center justify-center">
          <div className="flex items-center">
            <img src="/LOGO.png" alt="N Logo" className="h-14 w-auto" />
            <span className="text-[52px] font-bold text-black leading-none tracking-tighter -ml-2.5">EED</span>
          </div>
        </Link>
        <p className="mt-4 bg-[var(--color-brutal-yellow)] inline-block px-3 py-1 font-black tracking-widest uppercase text-sm brutal-border rotate-1">Technician Portal</p>
      </div>

      <div className="sm:mx-auto w-full max-w-2xl px-4 relative z-10">
        <ArtisanOnboarding />
      </div>
    </div>
  );
}
