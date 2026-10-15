"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import PayCommissionModal from "@/components/PayCommissionModal";
import Link from "next/link";
import ReportModal from "@/components/ReportModal";
import { AlertTriangle, Mailbox, MapPin, Clock, Map as MapIcon, MessageSquare, Calendar, X, PhoneCall, CheckCircle, Play, Wrench, Zap, Sparkles, Send, ArrowRight, Loader2, DollarSign } from "lucide-react";
import { useAlert } from "@/components/AlertProvider";
import { Capacitor } from "@capacitor/core";
import { formatDateTime12Hour } from "@/utils/formatTime";

export default function ArtisanDashboard() {
  const { showAlert } = useAlert();
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [upForGrabsJobs, setUpForGrabsJobs] = useState<JobRequest[]>([]);
  const [artisanServices, setArtisanServices] = useState<{ trade: string; subcategory: string }[]>([]);
  const [claimingJobId, setClaimingJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [reportingJob, setReportingJob] = useState<JobRequest | null>(null);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounterFor, setShowCounterFor] = useState<string | null>(null);
  const [promoDaysLeft, setPromoDaysLeft] = useState<number | null>(null);
  const [showPromoOverlay, setShowPromoOverlay] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [cancellingJob, setCancellingJob] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubs.forEach(unsub => unsub());
      unsubs = [];

      if (!user) {
        setLoading(false);
        return;
      }

      let validServices: { trade: string; subcategory: string }[] = [];
      let isVerifiedArtisan = false;
      let directResults: JobRequest[] = [];
      let broadcastResults: JobRequest[] = [];

      const updateCombined = () => {
        // Direct jobs assigned to this artisan - sort most recently active first
        const direct = [...directResults];
        direct.sort((a, b) => {
          const aTime = a.updatedAt || a.createdAt || 0;
          const bTime = b.updatedAt || b.createdAt || 0;
          return bTime - aTime;
        });

        // Open broadcast jobs up for grabs (STRICTLY matching technician's profile skills)
        const unassignedBroadcasts = broadcastResults.filter(job => {
          if (job.artisanId && job.artisanId !== "") return false;
          if (job.status !== "pending") return false;

          // Technician MUST have this trade / subcategory in their profile
          return validServices.some(svc => {
            if (!svc.trade || !job.trade) return false;
            const tradeMatches = svc.trade.trim().toLowerCase() === job.trade.trim().toLowerCase();
            if (svc.subcategory && job.subcategory) {
              return tradeMatches && svc.subcategory.trim().toLowerCase() === job.subcategory.trim().toLowerCase();
            }
            return tradeMatches;
          });
        });

        // Sort newest first
        unassignedBroadcasts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        setRequests(direct);
        setUpForGrabsJobs(unassignedBroadcasts);
        setArtisanServices(validServices);
        setLoading(false);
      };

      const handleErr = (err: any) => {
        console.warn("Artisan jobs listener error:", err?.message || err);
        setLoading(false);
      };

      const artisanRef = doc(db, "artisans", user.uid);
      const directQ = query(collection(db, "jobRequests"), where("artisanId", "==", user.uid));
      const broadcastQ = query(collection(db, "jobRequests"), where("isBroadcast", "==", true), where("status", "==", "pending"));

      const unsubArtisan = onSnapshot(artisanRef, (artDoc) => {
        if (artDoc.exists()) {
          const artisanData = artDoc.data();
          if (artisanData.createdAt) {
            const createdAtMs = typeof artisanData.createdAt === "number" 
              ? artisanData.createdAt 
              : artisanData.createdAt.toMillis?.() || Date.now();
            const daysSinceSignup = Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24));
            setPromoDaysLeft(Math.max(0, 30 - daysSinceSignup));
          }
          setWalletBalance(artisanData.walletBalance || 0);

          if (artisanData.services && artisanData.services.length > 0) {
            validServices = artisanData.services;
          } else {
            validServices = [{ trade: artisanData.trade, subcategory: artisanData.subcategory }];
          }
          isVerifiedArtisan = artisanData.verified || false;
          setIsVerified(isVerifiedArtisan);
          updateCombined();
        }
      }, handleErr);

      const unsubDirect = onSnapshot(directQ, (snap) => {
        directResults = snap.docs.map(doc => doc.data() as JobRequest);
        updateCombined();
      }, handleErr);

      const unsubBroadcast = onSnapshot(broadcastQ, (snap) => {
        broadcastResults = snap.docs.map(doc => doc.data() as JobRequest);
        updateCombined();
      }, handleErr);

      unsubs.push(unsubArtisan, unsubDirect, unsubBroadcast);
    });

    return () => {
      unsubs.forEach(unsub => unsub());
      unsubscribeAuth();
    };
  }, []);

  const handleClaimUpForGrabs = async (job: JobRequest) => {
    if (!isVerified) {
      showAlert("Your account must be approved by an administrator before you can accept jobs.", "error");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      showAlert("Please log in to claim jobs.", "error");
      return;
    }

    setClaimingJobId(job.requestId);
    try {
      const reqRef = doc(db, "jobRequests", job.requestId);
      const requiresDeposit = !job.depositPaid || job.depositStatus !== "held";
      const updatePayload: Partial<JobRequest> = {
        artisanId: user.uid,
        status: "accepted",
        state: requiresDeposit ? "awaiting_deposit" : "confirmed",
        depositStatus: requiresDeposit ? "pending" : (job.depositStatus || "held"),
        updatedAt: Date.now(),
      };

      await updateDoc(reqRef, updatePayload);
      showAlert("Job claimed successfully! Added to your active bookings.", "success");

      // Send push notification to customer
      if (job.customerId) {
        const requiresDeposit = !job.depositPaid || job.depositStatus !== "held";
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: job.customerId,
            title: requiresDeposit ? "Job Accepted - Deposit Required" : "Job Accepted!",
            body: requiresDeposit 
              ? `${user.displayName || "A technician"} has accepted your job request! Please pay the 25% commitment deposit to confirm.`
              : `${user.displayName || "A technician"} has accepted your broadcast job request.`,
            data: { requestId: job.requestId, type: "job_update", status: "accepted", state: requiresDeposit ? "awaiting_deposit" : "confirmed" }
          })
        }).catch(err => console.error("Failed to push notification:", err));
      }
    } catch (err: any) {
      console.error("Failed to claim job:", err);
      showAlert(err.message || "Failed to claim job", "error");
    } finally {
      setClaimingJobId(null);
    }
  };

  const handleCounterUpForGrabs = async (job: JobRequest, amount: number) => {
    if (!isVerified) {
      showAlert("Your account must be approved by an administrator before you can counter jobs.", "error");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    if (isNaN(amount) || amount <= 0) {
      showAlert("Please enter a valid counter amount.", "error");
      return;
    }

    setClaimingJobId(job.requestId);
    try {
      const reqRef = doc(db, "jobRequests", job.requestId);
      const updatePayload: Partial<JobRequest> = {
        artisanId: user.uid,
        status: "countered",
        state: "negotiating" as any,
        counterOfferAmount: amount,
        lastCounterBy: "artisan",
        updatedAt: Date.now(),
      };

      await updateDoc(reqRef, updatePayload);

      // Send push notification to customer
      if (job.customerId) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: job.customerId,
            title: "Counter Offer Received!",
            body: `${user.displayName || "A technician"} countered your job with ₦${amount.toLocaleString()}.`,
            data: { requestId: job.requestId, type: "job_update", status: "countered" }
          })
        }).catch(err => console.error("Failed to push notification:", err));
      }

      showAlert(`Counter offer of ₦${amount.toLocaleString()} submitted!`, "success");
      setShowCounterFor(null);
    } catch (err: any) {
      console.error("Failed to submit counter offer:", err);
      showAlert(err.message || "Failed to submit counter offer", "error");
    } finally {
      setClaimingJobId(null);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: JobRequest['status'], counterAmt: number | null = null, extraData?: any) => {
    if ((newStatus === 'accepted' || newStatus === 'countered') && !isVerified) {
      showAlert("Your account must be approved by an administrator before you can accept or counter jobs.", "error");
      return;
    }
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      const user = auth.currentUser;
      const req = requests.find(r => r.requestId === requestId);
      const requiresDeposit = !req?.depositPaid || req?.depositStatus !== "held";

      const updatePayload: Partial<JobRequest> = { 
        status: newStatus,
        state: newStatus === "accepted" && requiresDeposit ? "awaiting_deposit" : (newStatus as any),
        ...(newStatus === "accepted" && requiresDeposit ? { depositStatus: "pending" } : {})
      };
      if (req?.isBroadcast && user) {
        updatePayload.artisanId = user.uid;

        // Auto-add trade & subcategory to technician profile if missing
        try {
          const artisanRef = doc(db, "artisans", user.uid);
          const artisanSnap = await getDoc(artisanRef);
          if (artisanSnap.exists()) {
            const artData = artisanSnap.data();
            const currentServices: any[] = artData.services || (artData.trade && artData.subcategory ? [{ trade: artData.trade, subcategory: artData.subcategory }] : []);
            const alreadyHas = currentServices.some((s: any) => s.trade === req.trade && s.subcategory === req.subcategory);
            if (!alreadyHas && req.trade && req.subcategory) {
              const newServices = [
                ...currentServices,
                {
                  trade: req.trade,
                  subcategory: req.subcategory,
                  hasCertification: false,
                  certificateUrl: null,
                  isCertificateVerified: false
                }
              ];
              const newKeys = newServices.map((s: any) => `${s.trade}:${s.subcategory}`);
              await updateDoc(artisanRef, {
                services: newServices,
                serviceKeys: newKeys
              });
            }
          }
        } catch (skillErr) {
          console.warn("Could not auto-add skill to profile:", skillErr);
        }
      }

      if (newStatus === "arrived") {
        (updatePayload as any).arrivedAt = Date.now();
        (updatePayload as any).arrivalSource = "manual";
      }

      if (newStatus === "in_progress") {
        (updatePayload as any).startedAt = Date.now();
      }

      if (newStatus === "completed" || newStatus === "payment_pending") {
        updatePayload.completedAt = Date.now();
      }

      if (newStatus === "cancelled") {
        updatePayload.cancelledBy = "artisan";
        if (extraData?.reason) {
          updatePayload.cancelledReason = extraData.reason;
        }
      }

      if (newStatus === "countered" && counterAmt) {
        updatePayload.counterOfferAmount = counterAmt;
        updatePayload.lastCounterBy = "artisan";
      }

      if (newStatus === "declined") {
        updatePayload.declinedBy = "artisan";
      }

      if (newStatus === "cancelled") {
        updatePayload.cancelledBy = "artisan";
      }

      await updateDoc(reqRef, updatePayload);
      
      // Trigger Job Completed (Receipt) Email if marked as completed
      if ((newStatus === "completed" || newStatus === "payment_pending") && req && user) {
        fetch('/api/emails/job-completed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: req.customerId,
            technicianName: user.displayName || "A technician",
            trade: req.trade,
            amount: req.counterOfferAmount || req.offerAmount
          }),
        }).catch(e => console.error("Failed to send job completed email:", e));
      }

      // Send push notification to the customer via API
      if (req?.customerId && user) {
        let title = "Job Update";
        let body = "The status of your job request has changed.";
        
        if (newStatus === "accepted") {
          title = "Job Accepted!"; body = "Your technician has accepted the job request.";
        } else if (newStatus === "en_route") {
          title = "Technician En Route!"; body = "Your technician is on their way.";
        } else if (newStatus === "arrived") {
          title = "Technician Arrived!"; body = "Your technician has arrived at your location.";
        } else if (newStatus === "in_progress") {
          title = "Job Started!"; body = "Your technician has started work on your job.";
        } else if (newStatus === "completed" || newStatus === "payment_pending") {
          title = "Job Completed!"; body = "The job has been marked as completed.";
        }
        
        if (["accepted", "en_route", "arrived", "in_progress", "completed", "payment_pending"].includes(newStatus)) {
          fetch("/api/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: req.customerId,
              title,
              body,
              data: { requestId, type: "job_update", status: newStatus }
            })
          }).catch(err => console.error("Failed to push:", err));
        }
      }

      setRequests(prev => prev.map(r => {
        if (r.requestId === requestId) {
          const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
          const platformFeeRate = isPromoActive ? 0 : 0.20;
          return { 
            ...r, 
            status: newStatus, 
            ...(newStatus === "countered" ? { counterOfferAmount: counterAmt, platformFee: counterAmt! * platformFeeRate, lastCounterBy: "artisan" } : {}) 
          };
        }
        return r;
      }));
      setShowCounterFor(null);
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const handleSOS = async (requestId: string) => {
    if (confirm("Are you in immediate danger? This will alert our safety team and the authorities.")) {
      try {
        const reqRef = doc(db, "jobRequests", requestId);
        await updateDoc(reqRef, {
          sosAlert: true,
          sosTriggeredBy: "artisan",
          sosTriggeredAt: Date.now()
        });
        showAlert("SOS Alert triggered! Our team has been notified and will contact you immediately.", "info");
      } catch (err) {
        console.error(err);
        showAlert("Failed to trigger SOS", "error");
      }
    }
  };

  const [reschedulingJob, setReschedulingJob] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const handleRequestReschedule = async (requestId: string) => {
    if (!newDate || !newTime) {
      showAlert("Please select a new date and time", "error");
      return;
    }
    
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      const updatePayload: Partial<JobRequest> = {
        rescheduledAt: Date.now(),
        newPreferredTime: `${newDate} at ${newTime}`,
        rescheduleRequestedBy: "artisan",
        rescheduleStatus: "pending"
      };
      await updateDoc(reqRef, updatePayload);
      setRequests(prev => prev.map(req => req.requestId === requestId ? { ...req, ...updatePayload } : req));
      setReschedulingJob(null);
      showAlert("Reschedule request sent!", "success");
    } catch (err) {
      console.error(err);
      showAlert("Failed to send reschedule request", "error");
    }
  };

  const handleRespondReschedule = async (requestId: string, response: "accepted" | "declined", newPreferredTime: string) => {
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      const updatePayload: Partial<JobRequest> = {
        rescheduleStatus: response
      };
      if (response === "accepted") {
        updatePayload.preferredTime = newPreferredTime;
      }
      await updateDoc(reqRef, updatePayload);
      setRequests(prev => prev.map(req => req.requestId === requestId ? { ...req, ...updatePayload } : req));
      showAlert(`Reschedule ${response}`, "success");
    } catch (err) {
      console.error(err);
      showAlert("Error responding to reschedule", "error");
    }
  };

  const submitCounterOffer = (reqId: string) => {
    const val = parseInt(counterInputs[reqId]?.replace(/,/g, '') || "0", 10);
    if (!isNaN(val) && val > 0) {
      handleUpdateStatus(reqId, "countered", val);
    }
  };

  const unpaidJobs = requests.filter(job => job.proofOfPaymentUrl && !job.paidToPlatform);
  const outstandingBalance = unpaidJobs.reduce((sum, job) => sum + (job.platformFee || 0), 0);
  const oldestDebtAge = unpaidJobs.reduce((oldest, job) => {
    const age = job.proofOfPaymentAt ? Date.now() - job.proofOfPaymentAt : 0;
    return age > oldest ? age : oldest;
  }, 0);
  const isRestricted = oldestDebtAge > 7 * 24 * 60 * 60 * 1000;
  
  const [showPayModal, setShowPayModal] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pt-12 px-4 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">Job Requests</h1>
        <div className="mb-12 w-full block">
          <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-[var(--color-brutal-yellow)] inline-block pr-3 -rotate-1 shadow-[2px_2px_0_0_#000]">Manage incoming, active, and community broadcast jobs.</p>
        </div>

        {outstandingBalance > 0 && (
          <div className={`mb-10 p-6 brutal-border shadow-[4px_4px_0_0_#000] ${isRestricted ? 'bg-[var(--color-brutal-red)]' : 'bg-[var(--color-brutal-pink)]'}`}>
            <h2 className="text-2xl font-black uppercase text-black mb-2">
              {isRestricted ? <span className="flex items-center gap-2"><AlertTriangle className="w-6 h-6" /> ACCOUNT RESTRICTED</span> : 'OUTSTANDING BALANCE'}
            </h2>
            <p className="text-black font-bold mb-4 text-lg">
              You owe the platform <span className="font-black text-2xl">₦{outstandingBalance.toLocaleString()}</span> in commission for completed jobs.
              {isRestricted && " Your account has been restricted because your oldest unpaid commission is over 7 days late. Please pay to unlock new jobs."}
            </p>
            <button
              onClick={() => setShowPayModal(true)}
              className="bg-black text-white font-black uppercase py-3 px-6 brutal-btn border-4 border-white hover:bg-white hover:text-black transition-colors"
            >
              PAY COMMISSION NOW
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* UP FOR GRABS SECTION (OPEN COMMUNITY BROADCAST JOBS) */}
        {/* ============================================================== */}
        <div className="mb-14">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b-4 border-black pb-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--color-brutal-yellow)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000] rotate-3">
                  <Zap className="w-6 h-6 text-black fill-black" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-black uppercase tracking-tighter">
                  Up For Grabs
                </h2>
                <span className="bg-[var(--color-brutal-pink)] text-black border-2 border-black px-3 py-1 font-black text-xs uppercase shadow-[2px_2px_0_0_#000] -rotate-2">
                  {upForGrabsJobs.length} {upForGrabsJobs.length === 1 ? 'JOB OPEN' : 'JOBS OPEN'}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-800 mt-2">
                Broadcast jobs posted by customers seeking technicians. Claim immediately to accept and automatically add the trade to your verified skills!
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <GlobalSpinner text="SCANNING OPEN BROADCASTS" />
            </div>
          ) : upForGrabsJobs.length === 0 ? (
            <div className="bg-white p-8 md:p-10 text-center brutal-border brutal-shadow-sm mb-12">
              <div className="w-16 h-16 bg-[var(--color-brutal-yellow)] brutal-border flex items-center justify-center mx-auto mb-3 rotate-3 shadow-[2px_2px_0_0_#000]">
                <Zap className="w-8 h-8 text-black fill-black" />
              </div>
              <h3 className="text-xl font-black text-black mb-1 uppercase">All Caught Up!</h3>
              <p className="text-black font-bold text-sm">
                No open broadcast jobs right now. When customers post jobs waiting for an available technician, they will appear here live for anyone to claim.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
              {upForGrabsJobs.map((job) => {
                const isSkillMatch = artisanServices.some(svc => svc.trade === job.trade && svc.subcategory === job.subcategory);
                const currentPrice = job.offerAmount || 0;
                const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
                const platformFeeRate = isPromoActive ? 0 : 0.20;
                const platformFee = currentPrice * platformFeeRate;
                const artisanTakeHome = currentPrice - platformFee;
                const isClaiming = claimingJobId === job.requestId;
                const isCounteringThis = showCounterFor === job.requestId;

                const counterVal = parseInt(counterInputs[job.requestId]?.replace(/,/g, '') || "0", 10);
                const counterFee = counterVal * platformFeeRate;
                const counterTakeHome = counterVal - counterFee;

                return (
                  <div key={job.requestId} className="bg-white border-4 border-black shadow-[6px_6px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col h-full relative">
                    <div className="p-6 md:p-8 flex flex-col flex-grow">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        {isSkillMatch ? (
                          <span className="bg-[var(--color-brutal-teal)] text-black border-2 border-black px-3 py-1 text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#000]">
                            <Sparkles className="w-3.5 h-3.5 fill-black" /> MATCHES YOUR TRADE
                          </span>
                        ) : (
                          <span className="bg-[var(--color-brutal-pink)] text-black border-2 border-black px-3 py-1 text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#000]">
                            <Zap className="w-3.5 h-3.5 fill-black" /> OPEN COMMUNITY JOB • EXPAND SKILLS
                          </span>
                        )}
                        <span className="bg-black text-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wider">
                          BROADCAST
                        </span>
                      </div>

                      {/* Title & Price */}
                      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-5 border-b-4 border-black pb-5">
                        <div>
                          <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">
                            {job.trade ? `${job.trade} - ${job.subcategory}` : (job.subcategory || "Broadcast Request")}
                          </h3>
                          <div className="text-sm text-black font-bold flex flex-wrap items-center gap-2 uppercase tracking-widest mt-2">
                            <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2.5 py-1 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" /> {job.neighborhood || "Location on file"}
                            </span>
                            <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2.5 py-1 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" /> {formatDateTime12Hour(job.preferredTime) || "Flexible"}
                            </span>
                          </div>
                        </div>

                        {/* Price Tag */}
                        <div className="bg-[var(--color-brutal-bg)] brutal-border p-4 text-right min-w-[200px] shadow-[4px_4px_0_0_#000]">
                          <p className="text-xs text-black font-black uppercase tracking-widest mb-1 bg-white inline-block px-1 border-2 border-black -rotate-2">
                            Customer&apos;s Offer
                          </p>
                          <p className="text-4xl font-black text-black tracking-tighter mt-1">
                            ₦{currentPrice.toLocaleString()}
                          </p>
                          <div className="mt-2 text-xs font-black uppercase text-[var(--color-brutal-teal)] border-t-2 border-black pt-1">
                            Take Home: ₦{artisanTakeHome.toLocaleString()}
                          </div>
                          {isPromoActive && (
                            <p className="text-[10px] font-black text-purple-700 uppercase mt-0.5">
                              ✨ 0% Fee Promo Active
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Description & Media */}
                      {job.description && (
                        <div className="bg-[var(--color-brutal-yellow)] p-4 brutal-border mb-4 shadow-[2px_2px_0_0_#000]">
                          <p className="text-black font-bold leading-relaxed text-sm line-clamp-3">
                            {job.description}
                          </p>
                        </div>
                      )}

                      {job.mediaUrl && (
                        <div className="mb-4">
                          <a 
                            href={job.mediaUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-2 bg-white border-2 border-black px-3 py-1.5 text-xs font-black uppercase hover:bg-[var(--color-brutal-yellow)] transition-colors shadow-[2px_2px_0_0_#000]"
                          >
                            <span>📷 View Attached {job.mediaUrl.match(/\.(mp4|webm|mov|ogg)/i) ? "Video" : "Photo"}</span>
                          </a>
                        </div>
                      )}

                      {/* Inline Counter Form */}
                      {isCounteringThis && (
                        <div className="mb-6 p-4 bg-[var(--color-brutal-bg)] border-3 border-black shadow-[3px_3px_0_0_#000]">
                          <p className="text-xs font-black uppercase tracking-wider mb-2">Propose Counter Offer Amount (₦):</p>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-3 font-black text-lg">₦</span>
                              <input
                                type="text"
                                value={counterInputs[job.requestId] || ""}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");
                                  const formatted = raw ? Number(raw).toLocaleString() : "";
                                  setCounterInputs(prev => ({ ...prev, [job.requestId]: formatted }));
                                }}
                                placeholder="e.g. 25,000"
                                className="w-full pl-8 pr-3 py-2.5 font-black text-lg border-2 border-black brutal-shadow-sm focus:outline-none"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const val = parseInt(counterInputs[job.requestId]?.replace(/,/g, '') || "0", 10);
                                if (val > 0) handleCounterUpForGrabs(job, val);
                              }}
                              disabled={isClaiming || !counterVal}
                              className="px-4 py-2 bg-black text-white font-black text-sm uppercase border-2 border-black hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                            >
                              SUBMIT
                            </button>
                            <button
                              onClick={() => setShowCounterFor(null)}
                              className="px-3 py-2 bg-white text-black font-black text-sm uppercase border-2 border-black hover:bg-gray-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {counterVal > 0 && (
                            <p className="text-xs font-black text-[var(--color-brutal-teal)] mt-2">
                              Take home on counter: ₦{counterTakeHome.toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-auto flex flex-col sm:flex-row gap-3 pt-4 border-t-2 border-black">
                        <button
                          onClick={() => handleClaimUpForGrabs(job)}
                          disabled={isClaiming}
                          className="flex-1 bg-[var(--color-brutal-green)] text-black border-4 border-black font-black uppercase text-center py-4 hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all shadow-[4px_4px_0_0_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isClaiming ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>CLAIMING JOB...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5 stroke-[2.5]" />
                              <span>CLAIM JOB (₦{currentPrice.toLocaleString()})</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setShowCounterFor(isCounteringThis ? null : job.requestId)}
                          disabled={isClaiming}
                          className="bg-[var(--color-brutal-yellow)] text-black border-4 border-black font-black uppercase text-center py-4 px-5 hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all shadow-[4px_4px_0_0_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <Wrench className="w-5 h-5" />
                          <span>COUNTER</span>
                        </button>

                        <Link
                          href={`/technician/jobs/${job.requestId}`}
                          className="bg-white text-black border-4 border-black font-black uppercase text-center py-4 px-4 hover:bg-black hover:text-white transition-colors shadow-[4px_4px_0_0_#000] flex items-center justify-center gap-1"
                          title="View Details"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* DIRECT / ACTIVE REQUESTS SECTION */}
        {/* ============================================================== */}
        <h2 className="text-3xl font-black text-black mb-6 uppercase tracking-tighter border-b-4 border-black pb-2 inline-block">Recent Job Requests</h2>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <GlobalSpinner text="LOADING REQUESTS" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white p-12 text-center brutal-border brutal-shadow-sm">
            <div className="w-20 h-20 bg-[var(--color-brutal-pink)] brutal-border flex items-center justify-center mx-auto mb-4 rotate-6">
              <Mailbox className="w-12 h-12 stroke-[3] mx-auto" />
            </div>
            <h3 className="text-2xl font-black text-black mb-2 uppercase">No Requests Yet</h3>
            <p className="text-black font-bold">When customers request your services, they will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {requests.map((req) => {
              const currentStatus = String(req.status || req.state || 'pending');
              const currentPrice = req.counterOfferAmount || req.offerAmount || (req.agreedPrice ? Math.round(req.agreedPrice / 100) : 0);
              const isAwaitingCustDeposit = (req.status === "accepted" || currentStatus === "accepted") && 
                (req.state === "awaiting_deposit" || req.depositStatus === "pending" || (!req.depositPaid && req.depositStatus !== "held"));
              
              const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
              const platformFeeRate = isPromoActive ? 0 : 0.20;
              
              const platformFee = currentPrice * platformFeeRate;
              const artisanTakeHome = currentPrice - platformFee;

              // For dynamic counter offer calculation
              const typingVal = parseInt(counterInputs[req.requestId]?.replace(/,/g, '') || "0", 10);
              const dynamicFee = typingVal * platformFeeRate;
              const dynamicTakeHome = typingVal - dynamicFee;

              return (
                <div key={req.requestId} className="bg-white brutal-border brutal-shadow-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col h-full">
                  <div className="p-6 md:p-8 flex flex-col flex-grow">
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-6 border-b-4 border-black pb-6">
                      <div>
                        <span className={`inline-block px-4 py-2 text-xs font-black uppercase tracking-widest mb-3 brutal-border
                          ${isAwaitingCustDeposit ? 'bg-[var(--color-brutal-yellow)] text-black border-4 border-black' : ''}
                          ${!isAwaitingCustDeposit && currentStatus === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                          ${!isAwaitingCustDeposit && currentStatus === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                          ${!isAwaitingCustDeposit && currentStatus === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' : ''}
                          ${currentStatus === 'en_route' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                          ${currentStatus === 'in_progress' ? 'bg-[#bbf7d0] text-black' : ''}
                          ${currentStatus === 'payment_pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                          ${currentStatus === 'completed' ? 'bg-[var(--color-brutal-teal)] text-black' : ''}
                          ${currentStatus === 'declined' ? 'bg-[var(--color-brutal-red)] text-white' : ''}
                          ${currentStatus === 'cancelled' ? 'bg-gray-800 text-white' : ''}
                        `}>
                          {isAwaitingCustDeposit 
                            ? 'ACCEPTED • AWAITING CUSTOMER DEPOSIT'
                            : currentStatus === 'countered' 
                              ? (req.lastCounterBy === 'customer' ? 'ACTION REQUIRED' : 'AWAITING CUSTOMER') 
                              : currentStatus === 'declined' 
                                ? (req.declinedBy === 'artisan' ? 'TECHNICIAN DECLINED' : 'CUSTOMER DECLINED') 
                                : currentStatus.replace('_', ' ')}
                        </span>
                        <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">
                          {req.trade ? `${req.trade} - ${req.subcategory}` : (req.isBroadcast ? "Broadcast Request" : req.subcategory || "Service Request")}
                        </h3>
                        <p className="text-sm text-black font-bold flex flex-wrap items-center gap-2 uppercase tracking-widest mt-2">
                          <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.neighborhood || "Location on file"}</span>
                          <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateTime12Hour(req.preferredTime) || "Flexible"}</span>
                        </p>
                      </div>
                      
                      {/* Price Tag */}
                      <div className="bg-[var(--color-brutal-bg)] brutal-border p-4 text-right min-w-[200px] shadow-[4px_4px_0_0_#000]">
                        <p className="text-xs text-black font-black uppercase tracking-widest mb-1 bg-white inline-block px-1 border-2 border-black -rotate-2">
                          {currentStatus === "countered" ? "Counter Offer" : "Customer's Offer"}
                        </p>
                        <p className="text-4xl font-black text-black tracking-tighter mt-1">₦{currentPrice.toLocaleString()}</p>
                        <div className="mt-2 text-xs font-black uppercase text-[var(--color-brutal-teal)] border-t-2 border-black pt-1">
                          Take Home: ₦{artisanTakeHome.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {req.description && (
                      <div className="bg-[var(--color-brutal-yellow)] p-4 brutal-border mb-6 shadow-[2px_2px_0_0_#000]">
                        <p className="text-black font-bold leading-relaxed text-sm line-clamp-2">{req.description}</p>
                      </div>
                    )}

                    {currentStatus === "cancelled" && req.cancelledReason && (
                      <div className="bg-red-100 p-4 brutal-border mb-6 shadow-[2px_2px_0_0_#000] border-red-500">
                        <p className="font-black text-red-900 flex items-center gap-2 mb-1 uppercase tracking-widest text-xs"><AlertTriangle className="w-4 h-4" /> Job Cancelled</p>
                        <p className="font-bold text-red-800 text-sm">{req.cancelledReason}</p>
                      </div>
                    )}

                    <div className="mt-auto flex flex-col gap-3 pt-4 border-t-2 border-black">
                      {["accepted", "confirmed", "en_route", "arrived", "in_progress", "payment_pending", "completed"].includes(currentStatus) && (
                        <Link 
                          href={`/chat/${req.requestId}`} 
                          className="w-full bg-white border-4 border-black font-black uppercase text-center block py-4 hover:bg-[var(--color-brutal-bg)] transition-colors brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                        >
                          <span className="flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> CHAT WITH CUSTOMER</span>
                        </Link>
                      )}

                      <Link 
                        href={`/technician/jobs/${req.requestId}`} 
                        className="w-full bg-[var(--color-brutal-yellow)] border-4 border-black font-black uppercase text-center block py-4 hover:bg-black hover:text-white transition-colors brutal-shadow-sm"
                      >
                        <span className="flex items-center justify-center gap-2"><Wrench className="w-5 h-5" /> MANAGE BOOKING</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reportingJob && auth.currentUser && (
        <ReportModal 
          jobId={reportingJob.requestId}
          reportedUserId={reportingJob.customerId}
          reporterUserId={auth.currentUser.uid}
          reporterRole="artisan"
          onClose={() => setReportingJob(null)}
        />
      )}

      {/* Promo Overlay Modal */}
      {showPromoOverlay && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-8 border-black p-8 md:p-12 max-w-lg w-full brutal-shadow-lg relative rotate-1">
            <button 
              onClick={() => setShowPromoOverlay(false)}
              className="absolute top-4 right-4 w-12 h-12 bg-[var(--color-brutal-red)] border-4 border-black text-white font-black text-2xl brutal-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              X
            </button>
            <div className="bg-[var(--color-brutal-yellow)] border-4 border-black inline-block px-4 py-2 mb-6 -rotate-2">
              <h2 className="text-3xl md:text-4xl font-black text-black uppercase tracking-tighter">FIRST MONTH FREE!</h2>
            </div>
            <p className="text-xl font-bold text-black leading-tight mb-6">
              Welcome to Need! As a new artisan, you keep <span className="bg-[var(--color-brutal-teal)] border-2 border-black px-2 py-0.5 inline-block text-white">100% of your profits</span> for your first 30 days.
            </p>
            <p className="text-lg font-bold text-gray-700 mb-8 border-l-4 border-black pl-4">
              We've waived our standard 20% platform fee. Any job you accept or counter-offer during this period will have absolutely zero fees taken out. Go make that money!
            </p>
            <button 
              onClick={() => setShowPromoOverlay(false)}
              className="w-full bg-[var(--color-brutal-blue)] text-black text-2xl font-black py-4 border-4 border-black brutal-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all uppercase"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
      
      <PayCommissionModal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        unpaidJobs={unpaidJobs}
        totalOwed={outstandingBalance}
        onSuccess={() => {
          // Update local state immediately
          setRequests(prev => prev.map(req => 
            unpaidJobs.find(u => u.requestId === req.requestId) 
              ? { ...req, paidToPlatform: true, commissionPaid: true, commissionSettled: true } 
              : req
          ));
        }}
      />
    </div>
  );
}
