"use client";

import Link from "next/link";
import { Wrench, ShieldCheck, MapPin, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [bgIndex, setBgIndex] = useState(0);
  const router = useRouter();

  const backgrounds = [
    {
      desktop: "/images/bg-slideshow/black_electrician_1789676082386.jpg",
      mobile: "/images/bg-slideshow/mobile/black_electrician_mobile_1789676786481.jpg"
    },
    {
      desktop: "/images/bg-slideshow/black_plumber_1789676093444.jpg",
      mobile: "/images/bg-slideshow/mobile/black_plumber_mobile_1789676796246.jpg"
    },
    {
      desktop: "/images/bg-slideshow/black_carpenter_1789676104890.jpg",
      mobile: "/images/bg-slideshow/mobile/black_carpenter_mobile_1789677087562.jpg"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgrounds.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is logged in, bypass landing page
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.role === "artisan") {
              router.push("/technician/dashboard");
            } else {
              router.push("/explore");
            }
            return;
          }
        } catch (e) {
          console.error("Error bypassing landing page", e);
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col relative overflow-hidden text-black selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-[60vh] z-0 px-6 sm:px-8 lg:px-12 pointer-events-none opacity-20">
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

      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full py-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <img src="/LOGO.png" alt="N Logo" className="h-12 w-auto" />
            <span className="text-[44px] font-bold text-black leading-none tracking-tighter -ml-2">EED</span>
          </div>
        </div>
        <div>
          <Link href="/login?mode=signin" className="bg-[var(--color-brutal-yellow)] px-8 py-3 text-lg brutal-btn">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col justify-center py-12 md:py-20">
        <div className="max-w-4xl mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white brutal-border brutal-shadow-sm text-black font-black uppercase text-sm mb-8 tracking-widest">
            <ShieldCheck className="w-5 h-5 text-[var(--color-brutal-red)]" />
            100% Verified Pros
          </div>
          <h1 className="text-[2.5rem] leading-[1.1] sm:text-6xl md:text-8xl font-black text-black uppercase tracking-tighter mb-8">
            The Raw Way To Hire <br className="hidden md:block"/>
            <span className="bg-[var(--color-brutal-teal)] px-2 inline-block -rotate-1 mt-2 brutal-border max-w-full break-words">Trusted Technicians.</span>
          </h1>
          <p className="text-xl md:text-3xl text-black font-medium mb-12 max-w-3xl leading-snug border-l-8 border-black pl-6">
            From plumbers to electricians to tailors. Browse verified portfolios, read real reviews, and request skilled professionals instantly.
          </p>
          
          <div className="flex flex-col sm:flex-row items-start justify-start gap-6">
            <Link 
              href="/login?mode=signup&role=customer" 
              className="bg-[var(--color-brutal-red)] text-2xl px-10 py-5 brutal-btn w-full sm:w-auto"
            >
              Start Exploring <ArrowRight className="w-8 h-8 ml-3" />
            </Link>
            <Link 
              href="/login?mode=signup&role=artisan" 
              className="bg-white text-xl px-10 py-5 brutal-btn w-full sm:w-auto"
            >
              Become a Technician
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full pb-20">
          <div className="bg-[var(--color-brutal-blue)] p-8 brutal-card hover:-translate-y-2 transition-transform">
            <div className="w-16 h-16 bg-white brutal-border flex items-center justify-center mb-6 brutal-shadow-sm">
              <ShieldCheck className="w-10 h-10 text-black" />
            </div>
            <h3 className="text-2xl font-black text-black uppercase tracking-wider mb-4">Vetted & Verified</h3>
            <p className="text-black font-medium text-lg leading-relaxed">Every technician on our platform goes through a strict verification process before they can accept jobs.</p>
          </div>

          <div className="bg-[var(--color-brutal-yellow)] p-8 brutal-card hover:-translate-y-2 transition-transform">
            <div className="w-16 h-16 bg-white brutal-border flex items-center justify-center mb-6 brutal-shadow-sm">
              <MapPin className="w-10 h-10 text-black" />
            </div>
            <h3 className="text-2xl font-black text-black uppercase tracking-wider mb-4">Local to You</h3>
            <p className="text-black font-medium text-lg leading-relaxed">Find professionals who are already working in your exact neighborhood for faster response times.</p>
          </div>

          <div className="bg-[var(--color-brutal-pink)] p-8 brutal-card hover:-translate-y-2 transition-transform">
            <div className="w-16 h-16 bg-white brutal-border flex items-center justify-center mb-6 brutal-shadow-sm">
              <Wrench className="w-10 h-10 text-black" />
            </div>
            <h3 className="text-2xl font-black text-black uppercase tracking-wider mb-4">Transparent Portfolios</h3>
            <p className="text-black font-medium text-lg leading-relaxed">Don't rely on word of mouth. View photos of their past work and read reviews from your neighbors.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
