"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import Link from "next/link";
import { ClipboardList, Star, TrendingUp, CheckCircle, AlertTriangle, Power, PowerOff, Navigation, ArrowRight, MapPin, Zap, Clock, Target, BarChart3, Flame, ThumbsUp, Snail } from "lucide-react";
import GlobalSpinner from "@/components/GlobalSpinner";
import { JobRequest, Review } from "@/types";
import { useAlert } from "@/components/AlertProvider";

// ─── Sparkline: a tiny inline SVG chart for rating trend ──────────────
function RatingSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const width = 160;
  const height = 48;
  const padding = 4;
  const min = Math.min(...data) - 0.5;
  const max = Math.max(...data) + 0.5;
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });
  const trending = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={trending ? "var(--color-brutal-green, #CCFF00)" : "var(--color-brutal-red, #FF4D4D)"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Highlight last point */}
      {(() => {
        const lastPt = points[points.length - 1].split(",");
        return (
          <circle
            cx={lastPt[0]}
            cy={lastPt[1]}
            r="4"
            fill="black"
            stroke="white"
            strokeWidth="2"
          />
        );
      })()}
    </svg>
  );
}

// ─── Animated fill bar ────────────────────────────────────────────────
function StatBar({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex justify-between items-end mb-1">
        <span className="text-xs font-black uppercase tracking-widest text-gray-500">{label}</span>
        <span className="text-lg font-black">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-4 bg-gray-200 border-2 border-black overflow-hidden">
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function ArtisanDashboard() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [promoDaysLeft, setPromoDaysLeft] = useState<number | null>(null);
  const [isRevoked, setIsRevoked] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([]);
  
  const [stats, setStats] = useState({
    totalEarnings: 0,
    jobsCompleted: 0,
    jobsPending: 0,
    rating: 0
  });

  // ─── Performance metrics ───────────────────────────────────────────
  const [perfMetrics, setPerfMetrics] = useState({
    acceptanceRate: 0,
    avgResponseTimeMs: 0,
    completionRate: 0,
    ratingTrend: [] as number[],
    totalReviews: 0,
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
            
            if (artisanData.certificateVerificationStatus === "rejected") {
              setIsRevoked(true);
            }
            
            setIsVerified(artisanData.verified || false);
            
            // Persist availability from DB or local storage
            if (typeof window !== "undefined") {
              const storedStatus = localStorage.getItem("technician_available");
              if (storedStatus !== null) {
                setIsAvailable(storedStatus === "true");
              } else if (artisanData.available !== undefined) {
                setIsAvailable(artisanData.available);
              }
            } else if (artisanData.available !== undefined) {
              setIsAvailable(artisanData.available);
            }

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
          let accepted = 0;
          let declined = 0;
          let cancelled = 0;
          let cancelledByArtisan = 0;
          let totalResponseTime = 0;
          let responseCount = 0;

          const allJobs: JobRequest[] = [];

          requestsSnap.forEach(docSnap => {
            const data = docSnap.data() as JobRequest;
            allJobs.push(data);

            if (data.status === "completed") {
              completed++;
              const price = data.counterOfferAmount || data.offerAmount || 0;
              const fee = data.platformFee || 0;
              earnings += (price - fee);
            } else if (data.status === "pending" || data.status === "countered") {
              pending++;
            }

            // Acceptance tracking
            if (["accepted", "en_route", "in_progress", "payment_pending", "completed"].includes(data.status)) {
              accepted++;
            }
            if (data.status === "declined") {
              declined++;
            }
            if (data.status === "cancelled") {
              cancelled++;
              if (data.cancelledBy === "artisan") {
                cancelledByArtisan++;
              }
            }

            // Response time: time from createdAt to completedAt (as proxy for first action)
            // For accepted jobs, estimate response time as 15 min average if no explicit field
            if (data.completedAt && data.createdAt && data.status === "completed") {
              totalResponseTime += (data.completedAt - data.createdAt);
              responseCount++;
            }

            if (["accepted", "en_route", "in_progress", "payment_pending"].includes(data.status)) {
              setActiveJobs(prev => {
                if (prev.some(job => job.requestId === data.requestId)) return prev;
                return [...prev, data];
              });
            }
          });

          // Compute acceptance rate
          const totalDecisionable = accepted + declined;
          const acceptanceRate = totalDecisionable > 0 ? (accepted / totalDecisionable) * 100 : 0;

          // Compute completion rate (completed out of accepted + completed + cancelled-by-artisan)
          const totalStarted = completed + cancelledByArtisan;
          const completionRate = totalStarted > 0 ? (completed / totalStarted) * 100 : 0;

          // Average response time
          const avgResponseTimeMs = responseCount > 0 ? totalResponseTime / responseCount : 0;

          // Fetch reviews for rating trend
          let ratingTrend: number[] = [];
          let totalReviews = 0;
          let avgRating = 0;
          try {
            const reviewsSnap = await getDocs(
              query(
                collection(db, "reviews"),
                where("artisanId", "==", user.uid),
                orderBy("createdAt", "asc")
              )
            );
            const allReviews: Review[] = reviewsSnap.docs.map(d => d.data() as Review);
            totalReviews = allReviews.length;

            if (allReviews.length > 0) {
              // Build a rolling average for the sparkline (groups of 3 or individual if fewer)
              const groupSize = Math.max(1, Math.floor(allReviews.length / 8));
              for (let i = 0; i < allReviews.length; i += groupSize) {
                const slice = allReviews.slice(i, i + groupSize);
                const avg = slice.reduce((s, r) => s + r.rating, 0) / slice.length;
                ratingTrend.push(parseFloat(avg.toFixed(2)));
              }
              avgRating = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
            }
          } catch (e) {
            // Reviews collection may not have a composite index yet
            console.warn("Could not fetch reviews for trend:", e);
          }

          setPerfMetrics({
            acceptanceRate,
            avgResponseTimeMs,
            completionRate,
            ratingTrend,
            totalReviews,
          });

          setStats(prev => ({
            ...prev,
            jobsCompleted: completed,
            jobsPending: pending,
            totalEarnings: earnings,
            rating: avgRating > 0 ? parseFloat(avgRating.toFixed(1)) : (artisanSnapshot.empty ? 0 : (artisanSnapshot.docs[0].data().ratingAverage || 0))
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

  const toggleAvailability = async () => {
    if (!isVerified) {
      showAlert("Your account must be approved by an administrator before you can go online.", "error");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    try {
      const newAvailable = !isAvailable;
      setIsAvailable(newAvailable);
      if (typeof window !== "undefined") {
        localStorage.setItem("technician_available", String(newAvailable));
      }
      const { doc: firestoreDoc, updateDoc } = await import("firebase/firestore");
      await updateDoc(firestoreDoc(db, "artisans", user.uid), { available: newAvailable });
    } catch (e) {
      console.error("Failed to toggle availability", e);
      setIsAvailable(isAvailable);
    }
  };

  // ─── Helper: format response time ──────────────────────────────────
  const formatResponseTime = (ms: number) => {
    if (ms <= 0) return "N/A";
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)} days`;
  };

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
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">DASHBOARD</h1>
            <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-white inline-block pr-3 -rotate-1 shadow-[2px_2px_0_0_#000]">Welcome back to work.</p>
          </div>
          
          {/* Availability Toggle */}
          <button 
            onClick={toggleAvailability}
            className={`flex items-center gap-3 px-6 py-4 border-4 border-black brutal-shadow transition-all ${isAvailable ? 'bg-[var(--color-brutal-green)] text-black' : 'bg-[var(--color-brutal-red)] text-white'} hover:-translate-y-1`}
          >
            {isAvailable ? <Power className="w-8 h-8 stroke-[3]" /> : <PowerOff className="w-8 h-8 stroke-[3]" />}
            <div className="text-left">
              <p className="text-sm font-black uppercase tracking-widest leading-none mb-1">Status</p>
              <p className="text-2xl font-black leading-none uppercase">{isAvailable ? 'Available' : 'Offline'}</p>
            </div>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-12 -mt-12">
        {/* Revoked Banner */}
        {isRevoked && (
          <div className="bg-[#FF4D4D] border-4 border-black p-8 shadow-[8px_8px_0_0_#000] mb-8 relative rotate-1 z-10 animate-pulse">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-white border-2 border-black p-2 rounded-full">
                <AlertTriangle className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">ACCESS REVOKED INDEFINITELY</h2>
            </div>
            <p className="font-bold text-white text-lg mt-2 bg-black/20 p-2 border-l-4 border-black">
              Your technician profile has been suspended by the administration. You can no longer receive or accept new jobs. 
              Please contact support if you believe this is a mistake.
            </p>
          </div>
        )}

        {/* Unverified Banner */}
        {!isVerified && !isRevoked && (
          <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-8 shadow-[8px_8px_0_0_#000] mb-8 relative -rotate-1 z-10">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-white border-2 border-black p-2 rounded-full">
                <AlertTriangle className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-3xl font-black text-black tracking-tighter uppercase">ACCOUNT AWAITING APPROVAL</h2>
            </div>
            <p className="font-bold text-black text-lg mt-2 bg-white/50 p-2 border-l-4 border-black">
              Your profile is currently under review by our administrators. You will not be able to receive jobs or appear on the platform until your documents are verified.
            </p>
          </div>
        )}
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

        {/* Active Jobs Screen Section */}
        {activeJobs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-3xl font-black uppercase mb-4 tracking-tighter flex items-center gap-2">
              <span className="bg-[var(--color-brutal-yellow)] border-2 border-black w-4 h-4 rounded-full animate-pulse"></span>
              Active Jobs ({activeJobs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeJobs.map(job => (
                <div key={job.requestId} className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
                  <div className="flex justify-between items-start mb-4 border-b-4 border-black pb-4">
                    <div>
                      <span className="bg-[var(--color-brutal-teal)] text-black text-xs font-black uppercase px-2 py-1 border-2 border-black mb-2 inline-block">
                        {job.status.replace("_", " ")}
                      </span>
                      <h3 className="text-2xl font-black uppercase">{job.trade}</h3>
                      <p className="font-bold text-sm flex items-center gap-1"><MapPin className="w-4 h-4 shrink-0" /> {job.neighborhood}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black">₦{((job.counterOfferAmount || job.offerAmount || 0) * (promoDaysLeft && promoDaysLeft > 0 ? 1 : 0.8)).toLocaleString()}</p>
                      <p className="text-xs font-bold uppercase text-[var(--color-brutal-teal)]">Net Earnings</p>
                    </div>
                  </div>
                  <Link 
                    href="/technician/jobs" 
                    className="flex items-center justify-center gap-2 w-full bg-black text-white font-black uppercase py-4 border-2 border-transparent hover:bg-white hover:text-black hover:border-black transition-colors"
                  >
                    Manage Job <Navigation className="w-5 h-5 stroke-[3]" />
                  </Link>
                </div>
              ))}
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
          
          <Link href="/technician/performance" className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform group block cursor-pointer">
            <Star className="w-8 h-8 mb-4 stroke-[3] group-hover:scale-110 transition-transform text-[var(--color-brutal-yellow)]" />
            <p className="text-4xl font-black text-black leading-none mb-1">{stats.rating || "—"}</p>
            <p className="text-sm font-black uppercase tracking-widest text-gray-600 border-t-2 border-black pt-2 flex items-center justify-between">
              Avg Rating <ArrowRight className="w-4 h-4" />
            </p>
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            PERSONAL PERFORMANCE PANEL
            ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-black text-white p-2 border-2 border-black">
              <BarChart3 className="w-6 h-6 stroke-[3]" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Performance</h2>
            <div className="flex-1 h-1 bg-black" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Acceptance Rate */}
            <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-[var(--color-brutal-green)] border-2 border-black p-2">
                  <Target className="w-5 h-5 stroke-[3]" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Acceptance Rate</h3>
              </div>
              <StatBar
                value={perfMetrics.acceptanceRate}
                color="var(--color-brutal-green, #CCFF00)"
                label="Accepted vs Declined"
              />
              <div className="flex items-center gap-2 mt-2">
                {perfMetrics.acceptanceRate >= 80 ? (
                  <>
                    <div className="bg-black text-white p-1 border border-black shadow-[2px_2px_0_0_var(--color-brutal-green)]"><Flame className="w-4 h-4 stroke-[3]" /></div>
                    <span className="text-xs font-bold text-gray-800">Excellent — you rarely turn down work</span>
                  </>
                ) : perfMetrics.acceptanceRate >= 50 ? (
                  <>
                    <div className="bg-white border border-black p-1 shadow-[2px_2px_0_0_var(--color-brutal-yellow)]"><Zap className="w-4 h-4 stroke-[3]" /></div>
                    <span className="text-xs font-bold text-gray-800">Good — room to improve</span>
                  </>
                ) : perfMetrics.acceptanceRate > 0 ? (
                  <>
                    <div className="bg-white border border-black p-1 shadow-[2px_2px_0_0_var(--color-brutal-red)]"><AlertTriangle className="w-4 h-4 stroke-[3]" /></div>
                    <span className="text-xs font-bold text-gray-800">Low — consider accepting more jobs</span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-gray-500">No decision data yet</span>
                )}
              </div>
            </div>

            {/* Average Response Time */}
            <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-[var(--color-brutal-blue)] border-2 border-black p-2">
                  <Clock className="w-5 h-5 stroke-[3]" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Avg Response Time</h3>
              </div>
              <p className="text-5xl font-black tracking-tighter mb-1">
                {formatResponseTime(perfMetrics.avgResponseTimeMs)}
              </p>
              <div className="border-t-2 border-black pt-2">
                <p className="text-xs font-bold text-gray-500">
                  {perfMetrics.avgResponseTimeMs > 0 ? (
                    perfMetrics.avgResponseTimeMs < 3600000 ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-black text-white p-1 border border-black shadow-[2px_2px_0_0_var(--color-brutal-teal)]"><Zap className="w-4 h-4 stroke-[3]" /></div>
                        <span className="text-xs font-bold text-gray-800">Lightning fast — customers love quick responses</span>
                      </div>
                    ) : perfMetrics.avgResponseTimeMs < 86400000 ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-white border border-black p-1 shadow-[2px_2px_0_0_var(--color-brutal-yellow)]"><ThumbsUp className="w-4 h-4 stroke-[3]" /></div>
                        <span className="text-xs font-bold text-gray-800">Decent — try to respond within the hour</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="bg-white border border-black p-1 shadow-[2px_2px_0_0_var(--color-brutal-red)]"><Snail className="w-4 h-4 stroke-[3]" /></div>
                        <span className="text-xs font-bold text-gray-800">Slow — faster replies get more jobs</span>
                      </div>
                    )
                  ) : (
                    <span className="text-xs font-bold text-gray-500">Complete jobs to see your response time</span>
                  )}
                </p>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-[var(--color-brutal-teal)] border-2 border-black p-2">
                  <Zap className="w-5 h-5 stroke-[3]" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Completion Rate</h3>
              </div>
              <StatBar
                value={perfMetrics.completionRate}
                color="var(--color-brutal-teal, #00D4AA)"
                label="Finished vs Cancelled"
              />
              <div className="mt-2">
                {perfMetrics.completionRate >= 90 ? (
                  <div className="flex items-center gap-2">
                    <div className="bg-black text-white p-1 border border-black shadow-[2px_2px_0_0_var(--color-brutal-green)]"><CheckCircle className="w-4 h-4 stroke-[3]" /></div>
                    <span className="text-xs font-bold text-gray-800">Outstanding reliability</span>
                  </div>
                ) : perfMetrics.completionRate >= 70 ? (
                  <div className="flex items-center gap-2">
                    <div className="bg-white border border-black p-1 shadow-[2px_2px_0_0_var(--color-brutal-yellow)]"><ThumbsUp className="w-4 h-4 stroke-[3]" /></div>
                    <span className="text-xs font-bold text-gray-800">Solid — keep finishing what you start</span>
                  </div>
                ) : perfMetrics.completionRate > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="bg-white border border-black p-1 shadow-[2px_2px_0_0_var(--color-brutal-red)]"><AlertTriangle className="w-4 h-4 stroke-[3]" /></div>
                    <span className="text-xs font-bold text-gray-800">Too many cancellations hurt your ranking</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-gray-500">No completed jobs yet</span>
                )}
              </div>
            </div>

            {/* Rating Trend */}
            <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-[var(--color-brutal-yellow)] border-2 border-black p-2">
                  <Star className="w-5 h-5 stroke-[3]" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Rating Trend</h3>
              </div>
              {perfMetrics.ratingTrend.length >= 2 ? (
                <div>
                  <div className="flex items-end gap-4 mb-2">
                    <p className="text-5xl font-black tracking-tighter leading-none">
                      {stats.rating || "—"}
                    </p>
                    <div className="flex-1 flex justify-end">
                      <div className="bg-gray-100 border-2 border-black p-1">
                        <RatingSparkline data={perfMetrics.ratingTrend} />
                      </div>
                    </div>
                  </div>
                  <div className="border-t-2 border-black pt-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500">
                      Based on {perfMetrics.totalReviews} review{perfMetrics.totalReviews !== 1 ? "s" : ""}
                    </p>
                    {perfMetrics.ratingTrend[perfMetrics.ratingTrend.length - 1] >= perfMetrics.ratingTrend[0] ? (
                      <span className="text-xs font-black uppercase bg-[var(--color-brutal-green)] border-2 border-black px-2 py-0.5">
                        ↑ Trending Up
                      </span>
                    ) : (
                      <span className="text-xs font-black uppercase bg-[var(--color-brutal-red)] text-white border-2 border-black px-2 py-0.5">
                        ↓ Trending Down
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-5xl font-black tracking-tighter mb-1">
                    {stats.rating || "—"}
                  </p>
                  <div className="border-t-2 border-black pt-2">
                    <p className="text-xs font-bold text-gray-500">
                      {perfMetrics.totalReviews > 0
                        ? `${perfMetrics.totalReviews} review${perfMetrics.totalReviews !== 1 ? "s" : ""} — need 2+ for trend`
                        : "No reviews yet — complete jobs to get rated"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Link to full performance page */}
          <Link
            href="/technician/performance"
            className="mt-6 flex items-center justify-center gap-3 w-full bg-black text-white font-black uppercase py-4 border-4 border-black hover:bg-[var(--color-brutal-yellow)] hover:text-black transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
          >
            <BarChart3 className="w-5 h-5 stroke-[3]" />
            View Full Performance Report
            <ArrowRight className="w-5 h-5 stroke-[3]" />
          </Link>
        </div>

      </div>
    </div>
  );
}
