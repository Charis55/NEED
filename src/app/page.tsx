"use client";

import Link from "next/link";
import {
  Wrench,
  ShieldCheck,
  MapPin,
  ArrowRight,
  Award,
  Lock,
  PhoneCall,
  Clock,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Zap,
  Flame,
  PaintBucket,
  Hammer
} from "lucide-react";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { isNativeApp } from "@/utils/platform";
import StartupLoadingScreen from "@/components/StartupLoadingScreen";

export default function LandingPage() {
  const [bgIndex, setBgIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadProgress, setLoadProgress] = useState(20);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    // Instant cached redirect on mobile/web if user was previously authenticated
    if (typeof window !== "undefined") {
      const cachedRole = localStorage.getItem("need_user_role");
      if (cachedRole === "artisan") {
        router.replace("/technician/dashboard");
        return;
      } else if (cachedRole === "customer") {
        router.replace("/explore");
        return;
      }

      // Mobile app rule: Native iOS & Android apps do not have landing pages.
      // If unauthenticated on mobile, redirect straight to sign-in page.
      if (isNativeApp() && !localStorage.getItem("need_current_user_id")) {
        router.replace("/login");
        return;
      }
    }
  }, [router]);

  const backgrounds = [
    {
      desktop: "/images/bg-slideshow/black_electrician_1789676082386.jpg",
      mobile: "/images/bg-slideshow/mobile/black_electrician_mobile_1789676786481.jpg",
    },
    {
      desktop: "/images/bg-slideshow/black_plumber_1789676093444.jpg",
      mobile: "/images/bg-slideshow/mobile/black_plumber_mobile_1789676796246.jpg",
    },
    {
      desktop: "/images/bg-slideshow/black_carpenter_1789676104890.jpg",
      mobile: "/images/bg-slideshow/mobile/black_carpenter_mobile_1789677087562.jpg",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgrounds.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [backgrounds.length]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoadProgress(50);
        try {
          setLoadProgress(70);
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setLoadProgress(90);
            const data = userDoc.data();
            const role = data.role || "customer";
            if (typeof window !== "undefined") {
              localStorage.setItem("need_user_role", role);
            }
            setLoadProgress(100);
            if (role === "artisan") {
              router.replace("/technician/dashboard");
            } else {
              router.replace("/explore");
            }
            return;
          }
        } catch (e) {
          console.error("Error redirecting authenticated user", e);
        }
      } else {
        setLoadProgress(100);
        if (typeof window !== "undefined") {
          localStorage.removeItem("need_user_role");
          localStorage.removeItem("need_current_user_id");
        }
        // Native mobile apps (iOS & Android) must go straight to /login, never landing page
        if (isNativeApp()) {
          router.replace("/login");
          return;
        }
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // On native mobile apps, never render the landing page under any circumstances
  if (isNativeApp() || checkingAuth) {
    return (
      <StartupLoadingScreen
        progress={loadProgress}
        subtext="Initializing your NEED session"
        badge="STARTING UP"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col relative overflow-hidden text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Grid Pattern Background */}
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      ></div>

      {/* Decorative Slideshow Panel */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[45vh] z-0 px-6 sm:px-8 lg:px-12 pointer-events-none opacity-20">
        <div className="w-full h-full brutal-border brutal-shadow bg-[var(--color-brutal-yellow)] relative overflow-hidden">
          {backgrounds.map((bg, idx) => (
            <div
              key={bg.desktop}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out mix-blend-luminosity ${
                idx === bgIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden sm:block grayscale contrast-150"
                style={{ backgroundImage: `url('${bg.desktop}')` }}
              />
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat block sm:hidden grayscale contrast-150"
                style={{ backgroundImage: `url('${bg.mobile}')` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Bar */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center">
            <img src="/LOGO.png" alt="NEED Marketplace" className="h-12 w-auto transform translate-y-[-2px]" />
            <span className="text-[44px] font-bold text-black leading-none tracking-tighter -ml-2">EED</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/blog"
            className="hidden sm:inline-block font-black uppercase text-sm tracking-wider hover:text-[var(--color-brutal-teal)] transition-colors mr-2"
          >
            Guides & Articles
          </Link>
          <Link
            href="/about"
            className="hidden sm:inline-block font-black uppercase text-sm tracking-wider hover:text-[var(--color-brutal-teal)] transition-colors mr-2"
          >
            About
          </Link>
          <Link
            href="/login?mode=signin"
            className="bg-[var(--color-brutal-yellow)] px-6 py-2.5 text-base font-black uppercase brutal-btn"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col justify-center pt-8 pb-16">
        
        {/* HERO SECTION */}
        <section className="max-w-4xl mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white brutal-border brutal-shadow-sm text-black font-black uppercase text-xs sm:text-sm mb-6 tracking-widest">
            <ShieldCheck className="w-5 h-5 text-[var(--color-brutal-red)]" />
            Vetted Technicians • Escrow Protected • 30-Day Guarantee
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-black uppercase tracking-tighter mb-6 leading-[1.05]">
            The Reliable Way To Hire <br className="hidden md:block" />
            <span className="bg-[var(--color-brutal-teal)] px-2 inline-block -rotate-1 mt-2 brutal-border">
              Trusted Technicians.
            </span>
          </h1>

          <p className="text-lg sm:text-2xl text-black font-medium mb-10 max-w-3xl leading-snug border-l-8 border-black pl-6">
            From emergency plumbers and certified electricians to generator specialists and master carpenters.
            Inspect portfolios, get upfront escrow pricing, and hire local professionals with complete peace of mind.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-4">
            <Link
              href="/explore"
              className="bg-[var(--color-brutal-red)] text-xl sm:text-2xl px-8 sm:px-10 py-4 sm:py-5 brutal-btn text-center flex items-center justify-center text-white"
            >
              Start Exploring <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 ml-3" />
            </Link>
            <Link
              href="/login?mode=signup"
              className="bg-white text-lg sm:text-xl px-8 sm:px-10 py-4 sm:py-5 brutal-btn text-center"
            >
              Sign Up Free
            </Link>
            <Link
              href="/login?mode=signup&role=artisan"
              className="bg-[var(--color-brutal-yellow)] text-sm sm:text-base px-6 py-4 brutal-btn text-center font-black"
            >
              Join as Technician
            </Link>
          </div>
        </section>

        {/* 3 CORE PILLARS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-20">
          <div className="bg-[var(--color-brutal-blue)] p-8 brutal-card hover:-translate-y-1 transition-transform">
            <div className="w-14 h-14 bg-white brutal-border flex items-center justify-center mb-6 brutal-shadow-sm">
              <ShieldCheck className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-2xl font-black text-black uppercase tracking-wider mb-3">Identity Verified</h3>
            <p className="text-black font-medium text-base leading-relaxed">
              Every technician on NEED passes rigorous Know Your Customer (KYC) checks and police verification before entering homes.
            </p>
          </div>

          <div className="bg-[var(--color-brutal-yellow)] p-8 brutal-card hover:-translate-y-1 transition-transform">
            <div className="w-14 h-14 bg-white brutal-border flex items-center justify-center mb-6 brutal-shadow-sm">
              <Lock className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-2xl font-black text-black uppercase tracking-wider mb-3">Escrow Protected</h3>
            <p className="text-black font-medium text-base leading-relaxed">
              Never worry about losing money to uncompleted jobs. Deposits remain protected in licensed escrow until you inspect and approve the completed work.
            </p>
          </div>

          <div className="bg-[var(--color-brutal-pink)] p-8 brutal-card hover:-translate-y-1 transition-transform">
            <div className="w-14 h-14 bg-white brutal-border flex items-center justify-center mb-6 brutal-shadow-sm">
              <Award className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-2xl font-black text-black uppercase tracking-wider mb-3">30-Day Guarantee</h3>
            <p className="text-black font-medium text-base leading-relaxed">
              If any booked service develops defects within 30 days, our dispute moderation team arranges a free redo or full platform refund.
            </p>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="bg-white p-8 sm:p-12 brutal-border shadow-[8px_8px_0_0_#000] mb-20">
          <div className="max-w-2xl mb-10">
            <span className="bg-[var(--color-brutal-teal)] px-3 py-1 text-xs font-black uppercase tracking-widest brutal-border inline-block mb-3">
              Simple 3-Step Process
            </span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">
              How NEED Works
            </h2>
            <p className="text-gray-700 font-bold text-base mt-2">
              Hiring reliable local tradespeople has never been this transparent, fast, and secure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border-4 border-black p-6 bg-gray-50 space-y-3 relative">
              <span className="w-10 h-10 bg-black text-white font-black text-xl flex items-center justify-center border-2 border-black absolute -top-5 -left-3">
                1
              </span>
              <h4 className="text-xl font-black uppercase pt-2">Describe Your Need</h4>
              <p className="text-sm font-semibold text-gray-700">
                Pick your required trade (plumbing, wiring, carpentry, generator) and describe the job or broadcast your issue to nearby vetted technicians.
              </p>
            </div>

            <div className="border-4 border-black p-6 bg-gray-50 space-y-3 relative">
              <span className="w-10 h-10 bg-[var(--color-brutal-yellow)] text-black font-black text-xl flex items-center justify-center border-2 border-black absolute -top-5 -left-3">
                2
              </span>
              <h4 className="text-xl font-black uppercase pt-2">Agree on Price & Deposit</h4>
              <p className="text-sm font-semibold text-gray-700">
                Review transparent quotes with tiered repeat discounts. Fund the required deposit into secure platform escrow to confirm your booking.
              </p>
            </div>

            <div className="border-4 border-black p-6 bg-gray-50 space-y-3 relative">
              <span className="w-10 h-10 bg-[var(--color-brutal-teal)] text-black font-black text-xl flex items-center justify-center border-2 border-black absolute -top-5 -left-3">
                3
              </span>
              <h4 className="text-xl font-black uppercase pt-2">Track & Relax</h4>
              <p className="text-sm font-semibold text-gray-700">
                Track your technician in real-time, communicate via masked audio/video calls, and confirm completion. Covered by our 30-Day Guarantee.
              </p>
            </div>
          </div>
        </section>

        {/* POPULAR SERVICES DIRECTORY */}
        <section className="mb-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <span className="bg-[var(--color-brutal-pink)] px-3 py-1 text-xs font-black uppercase tracking-widest brutal-border inline-block mb-3">
                Marketplace Directory
              </span>
              <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">
                Featured Technician Trades
              </h2>
            </div>
            <Link
              href="/explore"
              className="font-black uppercase text-sm flex items-center gap-1 hover:text-[var(--color-brutal-teal)] underline"
            >
              View all 24 categories <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { title: "Plumbing Services", count: "Pipe burst, drainage, pump repair", icon: Wrench, color: "bg-blue-100" },
              { title: "Electrical Repairs", count: "Wiring, short circuit, breaker box", icon: Zap, color: "bg-yellow-100" },
              { title: "Generator Servicing", count: "Carburetor, coil, oil change", icon: Flame, color: "bg-orange-100" },
              { title: "Carpentry & Joinery", count: "Furniture repair, roofing, doors", icon: Hammer, color: "bg-amber-100" },
              { title: "Painting & Decor", count: "Interior, exterior, screeding", icon: PaintBucket, color: "bg-purple-100" },
              { title: "Air Conditioning", count: "Gas refill, servicing, compressor", icon: Sparkles, color: "bg-cyan-100" },
              { title: "Welding & Metalwork", count: "Gates, burglar proofing, rails", icon: Wrench, color: "bg-emerald-100" },
              { title: "Locksmith & Security", count: "Lock installation, key repairs", icon: Lock, color: "bg-rose-100" },
            ].map((cat, i) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={i}
                  href="/explore"
                  className={`${cat.color} p-5 border-4 border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all flex flex-col justify-between`}
                >
                  <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tight mb-1">{cat.title}</h4>
                    <p className="text-[11px] font-bold text-gray-700 leading-tight">{cat.count}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) */}
        <section className="bg-white p-8 sm:p-12 brutal-border shadow-[8px_8px_0_0_#000] mb-20 space-y-8">
          <div>
            <span className="bg-[var(--color-brutal-yellow)] px-3 py-1 text-xs font-black uppercase tracking-widest brutal-border inline-block mb-3">
              Transparency & FAQ
            </span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-700 font-bold text-base mt-2">
              Everything you need to know about safety, escrow deposits, and guaranteed quality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="border-3 border-black p-5 bg-gray-50 space-y-2">
              <h4 className="font-black uppercase text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                How are technicians vetted on NEED?
              </h4>
              <p className="text-gray-700 font-medium leading-relaxed">
                Every technician submits verified government issued documents (passport, voter's card, driver's license, national id card, etc), liveliness checks, and police clearance documentation. We mandate past work portfolios and only publish reviews verified by actual completed on-platform jobs.
              </p>
            </div>

            <div className="border-3 border-black p-5 bg-gray-50 space-y-2">
              <h4 className="font-black uppercase text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                How does the escrow deposit protect me?
              </h4>
              <p className="text-gray-700 font-medium leading-relaxed">
                When you accept a quote, your deposit is safely held by NEED. The technician only receives their earnings after they arrive, complete the physical work, and you confirm your satisfaction. If they do not show up, your deposit is 100% refunded.
              </p>
            </div>

            <div className="border-3 border-black p-5 bg-gray-50 space-y-2">
              <h4 className="font-black uppercase text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                What is the 30-Day Workmanship Guarantee?
              </h4>
              <p className="text-gray-700 font-medium leading-relaxed">
                If work completed through NEED develops faults within 30 days, customers can file a guarantee claim directly on the job receipt page. Our dispute team will dispatch the technician to fix it at ₦0 or issue a platform credit refund.
              </p>
            </div>

            <div className="border-3 border-black p-5 bg-gray-50 space-y-2">
              <h4 className="font-black uppercase text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                Do you charge repeat customers lower fees?
              </h4>
              <p className="text-gray-700 font-medium leading-relaxed">
                Yes! Our dynamic loyalty engine automatically reduces platform fees from 15% on the first job down to 10% on your second job, and 6% for frequent clients hiring the same trusted technician pair.
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA BANNER */}
        <section className="bg-[var(--color-brutal-yellow)] p-8 sm:p-14 border-6 border-black shadow-[10px_10px_0_0_#000] text-center space-y-6">
          <h2 className="text-3xl sm:text-6xl font-black uppercase tracking-tight">
            Ready to Fix Your Home with Zero Stress?
          </h2>
          <p className="text-lg sm:text-2xl font-bold max-w-2xl mx-auto">
            Find vetted local plumbers, electricians, carpenters, and technicians in your neighborhood now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/explore"
              className="bg-black text-white px-8 py-4 font-black uppercase text-lg border-2 border-black hover:bg-white hover:text-black transition-colors brutal-shadow-sm w-full sm:w-auto"
            >
              Browse Local Technicians
            </Link>
            <Link
              href="/blog"
              className="bg-white text-black px-8 py-4 font-black uppercase text-lg border-2 border-black hover:bg-[var(--color-brutal-pink)] transition-colors brutal-shadow-sm w-full sm:w-auto"
            >
              Read Repair Guides
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
