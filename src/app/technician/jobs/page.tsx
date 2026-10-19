"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import PayCommissionModal from "@/components/PayCommissionModal";
import Link from "next/link";
import ReportModal from "@/components/ReportModal";
import { AlertTriangle, Mailbox, MapPin, Clock, Map as MapIcon, MessageSquare, Calendar, X, PhoneCall, CheckCircle, Play, Wrench, Zap, Sparkles, Send, ArrowRight, Loader2, DollarSign, Search, ArrowUpDown, SlidersHorizontal, Camera, Star } from "lucide-react";
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
  
  // Search and Sort controls
  const [searchTerm, setSearchTerm] = useState("");
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search jobs, trades or areas...");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "closest_due" | "farthest_due" | "a_z" | "z_a">("newest");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "broadcasts" | "direct">("all");

  useEffect(() => {
    const updatePlaceholder = () => {
      const width = window.innerWidth;
      if (width < 440) {
        setSearchPlaceholder("Search trade, service, area...");
      } else if (width < 768) {
        setSearchPlaceholder("Search by trade, service or neighborhood...");
      } else {
        setSearchPlaceholder("Search jobs by trade, service, neighborhood, customer...");
      }
    };
    updatePlaceholder();
    window.addEventListener("resize", updatePlaceholder);
    return () => window.removeEventListener("resize", updatePlaceholder);
  }, []);

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const safetyTimer = setTimeout(() => setLoading(false), 2500);

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubs.forEach(unsub => unsub());
      unsubs = [];

      if (!user) {
        clearTimeout(safetyTimer);
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
      clearTimeout(safetyTimer);
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
        acceptedAt: Date.now(),
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
        ...(newStatus === "accepted" && requiresDeposit ? { depositStatus: "pending" } : {}),
        ...(newStatus === "accepted" ? { acceptedAt: Date.now() } : {}),
        updatedAt: Date.now(),
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
            ...(newStatus === "accepted" ? { acceptedAt: Date.now() } : {}),
            updatedAt: Date.now(),
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

  // Helper: get the most recent action/acceptance timestamp for a job
  const getJobActionTime = (job: JobRequest): number => {
    const toMs = (val: any) => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      if (typeof val.toMillis === "function") return val.toMillis();
      if (typeof val.toDate === "function") return val.toDate().getTime();
      const parsed = new Date(val).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };
    // Prioritize completedAt (if completed), then acceptedAt, then updatedAt, then createdAt
    return toMs(job.completedAt) || toMs(job.acceptedAt) || toMs(job.updatedAt) || toMs(job.createdAt) || 0;
  };

  // Helper: parse preferred due date/time to timestamp for closest/farthest sorting
  const getJobDueTime = (job: JobRequest): number => {
    const str = job.preferredTime;
    if (!str) return 0;

    // Check for "YYYY-MM-DD" format (with optional "at HH:MM AM/PM" or "at HH:MM")
    const dateMatch = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      
      let hours = 12;
      let minutes = 0;
      const timeMatch = str.match(/(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const meridian = timeMatch[3]?.toUpperCase();
        if (meridian === "PM" && hours < 12) hours += 12;
        if (meridian === "AM" && hours === 12) hours = 0;
      }
      const d = new Date(year, month, day, hours, minutes);
      const ms = d.getTime();
      if (!isNaN(ms)) return ms;
    }

    // Check for "DD/MM/YYYY" or "DD-MM-YYYY"
    const dmyMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day, 12, 0);
      const ms = d.getTime();
      if (!isNaN(ms)) return ms;
    }

    const cleanStr = str.replace(/\s+at\s+/i, " ");
    const parsed = Date.parse(cleanStr);
    if (!isNaN(parsed)) return parsed;

    return 0;
  };

  // Universal Sorter logic across all sections
  const sortJobsList = (list: JobRequest[]) => {
    return [...list].sort((a, b) => {
      const actionA = getJobActionTime(a);
      const actionB = getJobActionTime(b);
      const titleA = `${a.trade || ""} ${a.subcategory || ""}`.trim().toLowerCase();
      const titleB = `${b.trade || ""} ${b.subcategory || ""}`.trim().toLowerCase();

      if (sortBy === "newest") {
        return actionA - actionB;
      }
      if (sortBy === "oldest") {
        return actionB - actionA;
      }
      if (sortBy === "closest_due") {
        const dueA = getJobDueTime(a);
        const dueB = getJobDueTime(b);
        if (dueA === 0 && dueB === 0) return actionA - actionB;
        if (dueA === 0) return 1;
        if (dueB === 0) return -1;
        return dueB - dueA;
      }
      if (sortBy === "farthest_due") {
        const dueA = getJobDueTime(a);
        const dueB = getJobDueTime(b);
        if (dueA === 0 && dueB === 0) return actionA - actionB;
        if (dueA === 0) return 1;
        if (dueB === 0) return -1;
        return dueA - dueB;
      }
      if (sortBy === "a_z") return titleA.localeCompare(titleB);
      if (sortBy === "z_a") return titleB.localeCompare(titleA);
      return 0;
    });
  };

  const filterAndSortJobs = (list: JobRequest[]) => {
    if (!searchTerm.trim()) return sortJobsList(list);
    const term = searchTerm.toLowerCase().trim();
    const filtered = list.filter(j => {
      const trade = (j.trade || "").toLowerCase();
      const sub = (j.subcategory || "").toLowerCase();
      const neighborhood = (j.neighborhood || "").toLowerCase();
      const desc = (j.description || "").toLowerCase();
      const status = (j.status || "").toLowerCase();
      const custName = ((j as any).customerName || "").toLowerCase();
      const reqId = (j.requestId || "").toLowerCase();
      return trade.includes(term) || sub.includes(term) || neighborhood.includes(term) || desc.includes(term) || status.includes(term) || custName.includes(term) || reqId.includes(term);
    });
    return sortJobsList(filtered);
  };

  // Partition requests into active (ongoing/pending) and completed
  const activeRequests = requests.filter(r => r.status !== "completed");
  const completedRequests = requests.filter(r => r.status === "completed");

  const filteredBroadcasts = filterAndSortJobs(upForGrabsJobs);
  const filteredActiveRequests = filterAndSortJobs(activeRequests);
  const filteredCompletedRequests = filterAndSortJobs(completedRequests);

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] px-4 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">Job Requests</h1>
        <div className="mb-8 w-full block">
          <p className="text-black font-bold text-sm sm:text-lg border-l-4 border-black pl-3 bg-[var(--color-brutal-yellow)] inline-block pr-3 -rotate-1 shadow-[2px_2px_0_0_#000]">Manage incoming, active, and community broadcast jobs.</p>
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
        {/* SEARCH & SORTER BAR */}
        {/* ============================================================== */}
        <div className="bg-white border-4 border-black p-4 sm:p-6 shadow-[6px_6px_0_0_#000] mb-10">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 sm:pl-11 pr-10 py-3 sm:py-3.5 border-4 border-black font-black text-sm sm:text-base focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors placeholder:text-gray-500 placeholder:normal-case placeholder:font-bold placeholder:text-xs sm:placeholder:text-sm uppercase tracking-tight"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-black hover:text-[var(--color-brutal-red)] cursor-pointer"
                >
                  <X className="w-5 h-5 stroke-[3]" />
                </button>
              )}
            </div>

            {/* Sorter & Filter Tabs */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Neobrutalist Sorter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-2 border-4 border-black bg-[var(--color-brutal-pink)] px-4 py-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-black stroke-[3]" />
                    <span className="font-black uppercase text-xs sm:text-sm text-black">Sort</span>
                  </div>
                  <span className="text-[11px] font-black uppercase bg-white border border-black px-1.5 py-0.5 ml-1">
                    {sortBy === "newest" 
                      ? "Newest" 
                      : sortBy === "oldest" 
                        ? "Oldest" 
                        : sortBy === "closest_due" 
                          ? "Closest Due" 
                          : sortBy === "farthest_due" 
                            ? "Farthest Due" 
                            : sortBy === "a_z" 
                              ? "A-Z" 
                              : "Z-A"}
                  </span>
                </button>

                {isSortOpen && (
                  <div className="absolute top-12 left-0 sm:left-auto sm:right-0 z-50 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-56 sm:w-60 flex flex-col p-2 animate-in fade-in slide-in-from-top-2">
                    <p className="text-xs font-black uppercase text-gray-500 mb-2 px-2 border-b-2 border-gray-200 pb-1">Sort By</p>
                    {[
                      { label: "Newest First", value: "newest" },
                      { label: "Oldest First", value: "oldest" },
                      { label: "Closest Due Date", value: "closest_due" },
                      { label: "Farthest Due Date", value: "farthest_due" },
                      { label: "A to Z (Trade)", value: "a_z" },
                      { label: "Z to A (Trade)", value: "z_a" },
                    ].map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSortBy(option.value as any);
                          setIsSortOpen(false);
                        }}
                        className={`text-left px-2.5 py-2 font-black uppercase text-xs sm:text-sm border-2 transition-all cursor-pointer ${
                          sortBy === option.value 
                            ? "bg-[var(--color-brutal-yellow)] border-black" 
                            : "border-transparent hover:border-black hover:bg-gray-100"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex border-4 border-black bg-white shadow-[2px_2px_0_0_#000]">
                <button
                  onClick={() => setActiveFilterTab("all")}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-black uppercase transition-colors ${
                    activeFilterTab === "all" ? "bg-black text-white" : "hover:bg-gray-100 text-black"
                  }`}
                >
                  All ({filteredBroadcasts.length + filteredActiveRequests.length + filteredCompletedRequests.length})
                </button>
                <button
                  onClick={() => setActiveFilterTab("broadcasts")}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-black uppercase border-l-2 border-black transition-colors ${
                    activeFilterTab === "broadcasts" ? "bg-[var(--color-brutal-pink)] text-black" : "hover:bg-gray-100 text-black"
                  }`}
                >
                  Broadcasts ({filteredBroadcasts.length})
                </button>
                <button
                  onClick={() => setActiveFilterTab("direct")}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-black uppercase border-l-2 border-black transition-colors ${
                    activeFilterTab === "direct" ? "bg-[var(--color-brutal-blue)] text-black" : "hover:bg-gray-100 text-black"
                  }`}
                >
                  Direct ({filteredActiveRequests.length + filteredCompletedRequests.length})
                </button>
              </div>
            </div>
          </div>

          {searchTerm && (
            <div className="mt-3 flex items-center justify-between text-xs font-black uppercase border-t-2 border-black pt-2">
              <span className="text-gray-600">
                Found {filteredBroadcasts.length + filteredActiveRequests.length + filteredCompletedRequests.length} results matching &ldquo;{searchTerm}&rdquo;
              </span>
              <button 
                onClick={() => setSearchTerm("")} 
                className="underline text-[var(--color-brutal-red)] hover:opacity-80 cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* UP FOR GRABS SECTION (OPEN COMMUNITY BROADCAST JOBS) */}
        {/* ============================================================== */}
        {(activeFilterTab === "all" || activeFilterTab === "broadcasts") && (
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
                    {filteredBroadcasts.length} {filteredBroadcasts.length === 1 ? 'JOB OPEN' : 'JOBS OPEN'}
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
            ) : filteredBroadcasts.length === 0 ? (
              <div className="bg-white p-8 md:p-10 text-center brutal-border brutal-shadow-sm mb-12">
                <div className="w-16 h-16 bg-[var(--color-brutal-yellow)] brutal-border flex items-center justify-center mx-auto mb-3 rotate-3 shadow-[2px_2px_0_0_#000]">
                  <Zap className="w-8 h-8 text-black fill-black" />
                </div>
                <h3 className="text-xl font-black text-black mb-1 uppercase">
                  {searchTerm ? "No Matching Broadcast Jobs" : "All Caught Up!"}
                </h3>
                <p className="text-black font-bold text-sm">
                  {searchTerm
                    ? `No open broadcast jobs matched "${searchTerm}". Try checking your spelling or changing the filter.`
                    : "No open broadcast jobs right now. When customers post jobs waiting for an available technician, they will appear here live for anyone to claim."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                {filteredBroadcasts.map((job) => {
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
                  <div key={job.requestId} className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col h-full relative">
                    <div className="p-3.5 sm:p-5 flex flex-col flex-grow">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
                        {isSkillMatch ? (
                          <span className="bg-[var(--color-brutal-teal)] text-black border-2 border-black px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-black uppercase flex items-center gap-1 shadow-[2px_2px_0_0_#000]">
                            <Sparkles className="w-3 h-3 fill-black" /> MATCHES YOUR TRADE
                          </span>
                        ) : (
                          <span className="bg-[var(--color-brutal-pink)] text-black border-2 border-black px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-black uppercase flex items-center gap-1 shadow-[2px_2px_0_0_#000]">
                            <Zap className="w-3 h-3 fill-black" /> OPEN COMMUNITY JOB
                          </span>
                        )}
                        <span className="bg-black text-white px-2 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                          BROADCAST
                        </span>
                      </div>

                      {/* Title & Price Header */}
                      <div className="flex items-start justify-between gap-3 mb-3 border-b-2 sm:border-b-3 border-black pb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-xl font-black text-black uppercase tracking-tight truncate leading-tight">
                            {job.trade ? `${job.trade} - ${job.subcategory}` : (job.subcategory || "Broadcast Request")}
                          </h3>
                          <div className="text-xs text-black font-bold flex flex-wrap items-center gap-1.5 uppercase mt-1">
                            <span className="bg-[var(--color-brutal-bg)] border border-black px-2 py-0.5 flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate max-w-[130px] sm:max-w-none">{job.neighborhood || "Location on file"}</span>
                            </span>
                            <span className="bg-[var(--color-brutal-bg)] border border-black px-2 py-0.5 flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 shrink-0" /> {formatDateTime12Hour(job.preferredTime) || "Flexible"}
                            </span>
                          </div>
                        </div>

                        {/* Compact Price Box */}
                        <div className="bg-[var(--color-brutal-bg)] border-2 border-black p-2 sm:p-2.5 text-right shrink-0 shadow-[2px_2px_0_0_#000] min-w-[120px] sm:min-w-[140px]">
                          <p className="text-[10px] text-black font-black uppercase tracking-wider mb-0.5 bg-white inline-block px-1 border border-black">
                            Offer
                          </p>
                          <p className="text-lg sm:text-2xl font-black text-black tracking-tight leading-none mt-0.5">
                            ₦{currentPrice.toLocaleString()}
                          </p>
                          <div className="text-[10px] sm:text-xs font-black uppercase text-[var(--color-brutal-teal)] border-t border-black pt-0.5 mt-1">
                            Net: ₦{artisanTakeHome.toLocaleString()}
                          </div>
                          {isPromoActive && (
                            <p className="text-[9px] font-black text-purple-700 uppercase flex items-center justify-end gap-1 mt-0.5">
                              <Sparkles className="w-2.5 h-2.5 fill-purple-700" />
                              <span>0% Fee Promo</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Description & Media */}
                      {job.description && (
                        <div className="bg-[var(--color-brutal-yellow)] p-2.5 sm:p-3 border-2 border-black mb-3 shadow-[2px_2px_0_0_#000]">
                          <p className="text-black font-bold leading-snug text-xs sm:text-sm line-clamp-2">
                            {job.description}
                          </p>
                        </div>
                      )}

                      {job.mediaUrl && (
                        <div className="mb-3">
                          <a 
                            href={job.mediaUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1.5 bg-white border-2 border-black px-2.5 py-1 text-[11px] sm:text-xs font-black uppercase hover:bg-[var(--color-brutal-yellow)] transition-colors shadow-[2px_2px_0_0_#000]"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>View {job.mediaUrl.match(/\.(mp4|webm|mov|ogg)/i) ? "Video" : "Photo"}</span>
                          </a>
                        </div>
                      )}

                      {/* Inline Counter Form */}
                      {isCounteringThis && (
                        <div className="mb-4 p-3 bg-[var(--color-brutal-bg)] border-2 sm:border-3 border-black shadow-[2px_2px_0_0_#000]">
                          <p className="text-[11px] font-black uppercase tracking-wider mb-1.5">Propose Counter Amount (₦):</p>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-2 font-black text-sm">₦</span>
                              <input
                                type="text"
                                value={counterInputs[job.requestId] || ""}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");
                                  const formatted = raw ? Number(raw).toLocaleString() : "";
                                  setCounterInputs(prev => ({ ...prev, [job.requestId]: formatted }));
                                }}
                                placeholder="e.g. 25,000"
                                className="w-full pl-7 pr-2 py-1.5 font-black text-sm border-2 border-black brutal-shadow-sm focus:outline-none"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const val = parseInt(counterInputs[job.requestId]?.replace(/,/g, '') || "0", 10);
                                if (val > 0) handleCounterUpForGrabs(job, val);
                              }}
                              disabled={isClaiming || !counterVal}
                              className="px-3 py-1.5 bg-black text-white font-black text-xs uppercase border-2 border-black hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                            >
                              SUBMIT
                            </button>
                            <button
                              onClick={() => setShowCounterFor(null)}
                              className="px-2.5 py-1.5 bg-white text-black font-black text-xs uppercase border-2 border-black hover:bg-gray-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {counterVal > 0 && (
                            <p className="text-[11px] font-black text-[var(--color-brutal-teal)] mt-1.5">
                              Net on counter: ₦{counterTakeHome.toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-auto flex flex-col sm:flex-row gap-2 pt-3 border-t-2 border-black">
                        <button
                          onClick={() => handleClaimUpForGrabs(job)}
                          disabled={isClaiming}
                          className="flex-1 bg-[var(--color-brutal-green)] text-black border-3 border-black font-black uppercase text-center py-2.5 sm:py-3 px-3 hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs sm:text-sm"
                        >
                          {isClaiming ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>CLAIMING...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 stroke-[2.5]" />
                              <span>CLAIM JOB (₦{currentPrice.toLocaleString()})</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setShowCounterFor(isCounteringThis ? null : job.requestId)}
                          disabled={isClaiming}
                          className="bg-[var(--color-brutal-yellow)] text-black border-3 border-black font-black uppercase text-center py-2.5 sm:py-3 px-3 hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs sm:text-sm"
                        >
                          <Wrench className="w-4 h-4" />
                          <span>COUNTER</span>
                        </button>

                        <Link
                          href={`/technician/jobs/${job.requestId}`}
                          className="bg-white text-black border-3 border-black font-black uppercase text-center py-2.5 sm:py-3 px-3 hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1 text-xs sm:text-sm"
                          title="View Details"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* DIRECT / ACTIVE REQUESTS SECTION */}
      {/* ============================================================== */}
      {(activeFilterTab === "all" || activeFilterTab === "direct") && (
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b-4 border-black pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-brutal-blue)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000] -rotate-2">
                <Wrench className="w-6 h-6 text-black" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-black uppercase tracking-tighter">
                Recent Job Requests
              </h2>
              <span className="bg-[var(--color-brutal-yellow)] text-black border-2 border-black px-3 py-1 font-black text-xs uppercase shadow-[2px_2px_0_0_#000] rotate-2">
                {filteredActiveRequests.length} {filteredActiveRequests.length === 1 ? 'REQUEST' : 'REQUESTS'}
              </span>
            </div>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-20">
              <GlobalSpinner text="LOADING REQUESTS" />
            </div>
          ) : filteredActiveRequests.length === 0 ? (
            <div className="bg-white p-12 text-center brutal-border brutal-shadow-sm">
              <div className="w-20 h-20 bg-[var(--color-brutal-pink)] brutal-border flex items-center justify-center mx-auto mb-4 rotate-6">
                <Mailbox className="w-12 h-12 stroke-[3] mx-auto" />
              </div>
              <h3 className="text-2xl font-black text-black mb-2 uppercase">
                {activeRequests.length === 0 ? "No Active Requests" : "No Matching Requests"}
              </h3>
              <p className="text-black font-bold">
                {activeRequests.length === 0 
                  ? "When customers request your services, they will appear here." 
                  : "Try adjusting your search query or sorting filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredActiveRequests.map((req) => {
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
                <div key={req.requestId} className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col h-full">
                  <div className="p-3.5 sm:p-5 flex flex-col flex-grow">
                    <div className="flex items-start justify-between gap-3 mb-3 border-b-2 sm:border-b-3 border-black pb-3">
                      <div className="min-w-0 flex-1">
                        <span className={`inline-block px-2.5 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1.5 border-2 border-black shadow-[2px_2px_0_0_#000]
                          ${isAwaitingCustDeposit ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                          ${!isAwaitingCustDeposit && currentStatus === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                          ${!isAwaitingCustDeposit && currentStatus === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                          ${!isAwaitingCustDeposit && currentStatus === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' : ''}
                          ${currentStatus === 'en_route' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                          ${currentStatus === 'in_progress' ? 'bg-[#bbf7d0] text-black' : ''}
                          ${currentStatus === 'payment_pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                          ${currentStatus === 'declined' ? 'bg-[var(--color-brutal-red)] text-white' : ''}
                          ${currentStatus === 'cancelled' ? 'bg-gray-800 text-white' : ''}
                        `}>
                          {isAwaitingCustDeposit 
                            ? 'ACCEPTED • AWAITING DEPOSIT'
                            : currentStatus === 'countered' 
                              ? (req.lastCounterBy === 'customer' ? 'ACTION REQUIRED' : 'AWAITING CUSTOMER') 
                              : currentStatus === 'declined' 
                                ? (req.declinedBy === 'artisan' ? 'TECH DECLINED' : 'CUSTOMER DECLINED') 
                                : currentStatus.replace('_', ' ')}
                        </span>
                        <h3 className="text-base sm:text-xl font-black text-black uppercase tracking-tight truncate leading-tight">
                          {req.trade ? `${req.trade} - ${req.subcategory}` : (req.isBroadcast ? "Broadcast Request" : req.subcategory || "Service Request")}
                        </h3>
                        <p className="text-xs text-black font-bold flex flex-wrap items-center gap-1.5 uppercase mt-1">
                          <span className="bg-[var(--color-brutal-bg)] border border-black px-2 py-0.5 flex items-center gap-1 text-[11px]"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate max-w-[130px] sm:max-w-none">{req.neighborhood || "Location on file"}</span></span>
                          <span className="bg-[var(--color-brutal-bg)] border border-black px-2 py-0.5 flex items-center gap-1 text-[11px]"><Clock className="w-3 h-3 shrink-0" /> {formatDateTime12Hour(req.preferredTime) || "Flexible"}</span>
                        </p>
                      </div>
                      
                      {/* Compact Price Tag */}
                      <div className="bg-[var(--color-brutal-bg)] border-2 border-black p-2 sm:p-2.5 text-right shrink-0 shadow-[2px_2px_0_0_#000] min-w-[120px] sm:min-w-[140px]">
                        <p className="text-[10px] text-black font-black uppercase tracking-wider mb-0.5 bg-white inline-block px-1 border border-black">
                          {currentStatus === "countered" ? "Counter" : "Offer"}
                        </p>
                        <p className="text-lg sm:text-2xl font-black text-black tracking-tight leading-none mt-0.5">₦{currentPrice.toLocaleString()}</p>
                        <div className="text-[10px] sm:text-xs font-black uppercase text-[var(--color-brutal-teal)] border-t border-black pt-0.5 mt-1">
                          Net: ₦{artisanTakeHome.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {req.description && (
                      <div className="bg-[var(--color-brutal-yellow)] p-2.5 sm:p-3 border-2 border-black mb-3 shadow-[2px_2px_0_0_#000]">
                        <p className="text-black font-bold leading-snug text-xs sm:text-sm line-clamp-2">{req.description}</p>
                      </div>
                    )}

                    {currentStatus === "cancelled" && req.cancelledReason && (
                      <div className="bg-red-100 p-2.5 sm:p-3 border-2 border-black mb-3 shadow-[2px_2px_0_0_#000] border-red-500">
                        <p className="font-black text-red-900 flex items-center gap-1.5 mb-1 uppercase tracking-wider text-[11px]"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Job Cancelled</p>
                        <p className="font-bold text-red-800 text-xs">{req.cancelledReason}</p>
                      </div>
                    )}

                    <div className="mt-auto flex flex-col gap-2 pt-3 border-t-2 border-black">
                      {["accepted", "confirmed", "en_route", "arrived", "in_progress", "payment_pending"].includes(currentStatus) && (
                        <Link 
                          href={`/chat/${req.requestId}`} 
                          className="w-full bg-white border-3 border-black font-black uppercase text-center block py-2.5 sm:py-3 hover:bg-[var(--color-brutal-bg)] transition-colors shadow-[2px_2px_0_0_#000] text-xs sm:text-sm"
                        >
                          <span className="flex items-center justify-center gap-1.5"><MessageSquare className="w-4 h-4" /> CHAT WITH CUSTOMER</span>
                        </Link>
                      )}

                      <Link 
                        href={`/technician/jobs/${req.requestId}`} 
                        className="w-full bg-[var(--color-brutal-yellow)] border-3 border-black font-black uppercase text-center block py-2.5 sm:py-3 hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_0_#000] text-xs sm:text-sm"
                      >
                        <span className="flex items-center justify-center gap-1.5"><Wrench className="w-4 h-4" /> MANAGE BOOKING</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* COMPLETED JOBS SECTION */}
        {/* ============================================================== */}
        <div className="mt-14">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b-4 border-black pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-brutal-green)] border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000] rotate-2">
                <CheckCircle className="w-6 h-6 text-black" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-black uppercase tracking-tighter">
                Completed Jobs
              </h2>
              <span className="bg-[var(--color-brutal-teal)] text-black border-2 border-black px-3 py-1 font-black text-xs uppercase shadow-[2px_2px_0_0_#000] -rotate-1">
                {filteredCompletedRequests.length} {filteredCompletedRequests.length === 1 ? 'JOB COMPLETED' : 'JOBS COMPLETED'}
              </span>
            </div>
            <p className="text-sm font-bold text-gray-800 mt-2 md:mt-0">
              All jobs you have successfully delivered and settled on the platform.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <GlobalSpinner text="LOADING COMPLETED JOBS" />
            </div>
          ) : filteredCompletedRequests.length === 0 ? (
            <div className="bg-white p-8 md:p-10 text-center brutal-border brutal-shadow-sm mb-12">
              <div className="w-16 h-16 bg-[var(--color-brutal-teal)] brutal-border flex items-center justify-center mx-auto mb-3 rotate-2 shadow-[2px_2px_0_0_#000]">
                <CheckCircle className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-xl font-black text-black mb-1 uppercase">
                {searchTerm ? "No Matching Completed Jobs" : "No Completed Jobs Yet"}
              </h3>
              <p className="text-black font-bold text-sm">
                {searchTerm
                  ? `No completed jobs matched "${searchTerm}".`
                  : "Jobs you finish and receive payment for will be archived here."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
              {filteredCompletedRequests.map((req) => {
                const finalPrice = req.agreedPrice ? Math.round(req.agreedPrice / 100) : (req.counterOfferAmount || req.offerAmount || 0);
                const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
                const platformFeeRate = isPromoActive ? 0 : 0.20;
                const platformFee = req.platformFee ?? (finalPrice * platformFeeRate);
                const artisanTakeHome = finalPrice - platformFee;

                return (
                  <div key={req.requestId} className="bg-white border-3 sm:border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col h-full">
                    <div className="p-3.5 sm:p-5 flex flex-col flex-grow">
                      <div className="flex items-start justify-between gap-3 mb-3 border-b-2 sm:border-b-3 border-black pb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className="inline-block px-2.5 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0_0_#000] bg-[var(--color-brutal-teal)] text-black">
                              COMPLETED
                            </span>
                            {req.reviewed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0_0_#000] bg-[var(--color-brutal-yellow)] text-black">
                                <Star className="w-2.5 h-2.5 fill-black text-black" />
                                <span>REVIEWED</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-base sm:text-xl font-black text-black uppercase tracking-tight truncate leading-tight">
                            {req.trade ? `${req.trade} - ${req.subcategory}` : (req.isBroadcast ? "Broadcast Request" : req.subcategory || "Service Request")}
                          </h3>
                          <p className="text-xs text-black font-bold flex flex-wrap items-center gap-1.5 uppercase mt-1">
                            <span className="bg-[var(--color-brutal-bg)] border border-black px-2 py-0.5 flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate max-w-[130px] sm:max-w-none">{req.neighborhood || "Location on file"}</span>
                            </span>
                            <span className="bg-[var(--color-brutal-bg)] border border-black px-2 py-0.5 flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 shrink-0" /> {formatDateTime12Hour(req.completedAt ? new Date(req.completedAt).toISOString() : req.preferredTime) || "Completed"}
                            </span>
                          </p>
                        </div>
                        
                        {/* Final Price Tag */}
                        <div className="bg-[var(--color-brutal-bg)] border-2 border-black p-2 sm:p-2.5 text-right shrink-0 shadow-[2px_2px_0_0_#000] min-w-[120px] sm:min-w-[140px]">
                          <p className="text-[10px] text-black font-black uppercase tracking-wider mb-0.5 bg-white inline-block px-1 border border-black">
                            Final Price
                          </p>
                          <p className="text-lg sm:text-2xl font-black text-black tracking-tight leading-none mt-0.5">₦{finalPrice.toLocaleString()}</p>
                          <div className="text-[10px] sm:text-xs font-black uppercase text-[var(--color-brutal-teal)] border-t border-black pt-0.5 mt-1">
                            Earned: ₦{artisanTakeHome.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {req.description && (
                        <div className="bg-gray-100 p-2.5 sm:p-3 border-2 border-black mb-3 shadow-[2px_2px_0_0_#000]">
                          <p className="text-black font-bold leading-snug text-xs sm:text-sm line-clamp-2">{req.description}</p>
                        </div>
                      )}

                      <div className="mt-auto flex flex-col sm:flex-row gap-2 pt-3 border-t-2 border-black">
                        <Link 
                          href={`/chat/${req.requestId}`} 
                          className="flex-1 bg-white border-3 border-black font-black uppercase text-center block py-2.5 sm:py-3 hover:bg-[var(--color-brutal-bg)] transition-colors shadow-[2px_2px_0_0_#000] text-xs sm:text-sm"
                        >
                          <span className="flex items-center justify-center gap-1.5"><MessageSquare className="w-4 h-4" /> CHAT ARCHIVE</span>
                        </Link>
                        <Link 
                          href={`/technician/jobs/${req.requestId}`} 
                          className="flex-1 bg-[var(--color-brutal-yellow)] border-3 border-black font-black uppercase text-center block py-2.5 sm:py-3 hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_0_#000] text-xs sm:text-sm"
                        >
                          <span className="flex items-center justify-center gap-1.5"><Wrench className="w-4 h-4" /> DETAILS & RECEIPT</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
