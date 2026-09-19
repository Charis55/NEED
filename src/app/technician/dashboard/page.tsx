"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import Link from "next/link";
import { ClipboardList, Star, TrendingUp, CheckCircle } from "lucide-react";
import GlobalSpinner from "@/components/GlobalSpinner";

export default function ArtisanDashboard() {
  const [loading, setLoading] = useState(true);
  const [promoDaysLeft, setPromoDaysLeft] = useState<number | null>(null);
  
  const [stats, setStats] = useState({
    totalEarnings: 0,
    jobsCompleted: 0,
    jobsPending: 0,
    rating: 4.8 // Mock rating for now
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const fetchDashboardData = async () => {
        try {
          const artisanSnapshot = await getDocs(query(collection(db, "artisans"), where("artisanId", "==", user.uid)));
          if (!artisanSnapshot.empty) {
            const artisanData = artisanSnapshot.docs[0].data();
            if (artisanData.createdAt) {
              const createdAtMs = typeof artisanData.createdAt === "number" 
                ? artisanData.createdAt 
                : artisanData.createdAt.toMillis?.() || Date.now();
              const daysSinceSignup = Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24));
              setPromoDaysLeft(Math.max(0, 30 - daysSinceSignup));
            }
          }

          const q = query(
            collection(db, "jobRequests"),
            where("artisanId", "==", user.uid)
          );
          const requestsSnap = await getDocs(q);
          
          let completed = 0;
          let pending = 0;
          let earnings = 0;

          requestsSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === "completed") {
              completed++;
              // Calculate earnings based on promo logic or standard 20% cut
              const price = data.counterOfferAmount || data.offerAmount || 0;
              const fee = data.platformFee || 0;
              earnings += (price - fee);
            } else if (data.status === "pending" || data.status === "countered") {
              pending++;
            }
          });

          setStats(prev => ({
            ...prev,
            jobsCompleted: completed,
            jobsPending: pending,
            totalEarnings: earnings
          }));
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchDashboardData();
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex justify-center items-center">
        <GlobalSpinner size="lg" text="LOADING DASHBOARD" color="bg-[var(--color-brutal-blue)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Banner */}
      <div className="bg-[var(--color-brutal-blue)] pt-16 pb-24 px-6 md:px-12 border-b-4 border-black brutal-shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">DASHBOARD</h1>
            <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-white inline-block pr-3 -rotate-1 shadow-[2px_2px_0_0_#000]">Welcome back to work.</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-12 -mt-12">
        {/* Promo Banner */}
        {promoDaysLeft !== null && promoDaysLeft > 0 && (
          <div className="bg-[var(--color-brutal-pink)] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] mb-8 flex flex-col md:flex-row items-start md:items-center justify-between rotate-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <div className="mb-4 md:mb-0">
              <p className="text-black text-sm font-black mb-1 uppercase tracking-widest flex items-center gap-2">
                <span className="bg-white border-2 border-black px-1 -rotate-2">PROMO ACTIVE</span>
              </p>
              <h2 className="text-3xl font-black text-black tracking-tighter uppercase">First Month Free!</h2>
              <p className="font-bold text-black border-t-2 border-black pt-1 mt-1 inline-block">Keep 100% of your earnings.</p>
            </div>
            <div className="text-center bg-white border-4 border-black p-3 min-w-[100px] shadow-[2px_2px_0_0_#000] -rotate-2">
              <p className="text-4xl font-black text-[var(--color-brutal-red)] leading-none">{promoDaysLeft}</p>
              <p className="text-sm font-black text-black uppercase mt-1">Days Left</p>
            </div>
          </div>
        )}

        {/* Balance Card */}
        <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-8 shadow-[6px_6px_0_0_#000] mb-8 -rotate-1 relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-white border-4 border-black w-12 h-12 flex items-center justify-center rotate-12 shadow-[2px_2px_0_0_#000]">
            <TrendingUp className="w-8 h-8 stroke-[3]" />
          </div>
          <p className="text-black text-sm font-black mb-2 uppercase tracking-widest">Total Earnings</p>
          <p className="text-5xl md:text-7xl font-black text-black tracking-tighter">₦{stats.totalEarnings.toLocaleString()}</p>
          <Link href="/technician/earnings" className="mt-6 inline-block bg-black text-white px-6 py-3 font-black uppercase text-sm tracking-widest hover:bg-[var(--color-brutal-teal)] hover:text-black transition-colors border-2 border-black">
            View Payment History
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform group">
            <CheckCircle className="w-8 h-8 mb-4 stroke-[3] group-hover:scale-110 transition-transform text-[var(--color-brutal-teal)]" />
            <p className="text-4xl font-black text-black leading-none mb-1">{stats.jobsCompleted}</p>
            <p className="text-sm font-black uppercase tracking-widest text-gray-600 border-t-2 border-black pt-2">Jobs Done</p>
          </div>
          
          <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform group">
            <ClipboardList className="w-8 h-8 mb-4 stroke-[3] group-hover:scale-110 transition-transform text-[var(--color-brutal-pink)]" />
            <p className="text-4xl font-black text-black leading-none mb-1">{stats.jobsPending}</p>
            <p className="text-sm font-black uppercase tracking-widest text-gray-600 border-t-2 border-black pt-2">New Requests</p>
          </div>
          
          <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform group">
            <Star className="w-8 h-8 mb-4 stroke-[3] group-hover:scale-110 transition-transform text-[var(--color-brutal-yellow)]" />
            <p className="text-4xl font-black text-black leading-none mb-1">{stats.rating}</p>
            <p className="text-sm font-black uppercase tracking-widest text-gray-600 border-t-2 border-black pt-2">Avg Rating</p>
          </div>
        </div>

      </div>
    </div>
  );
}
