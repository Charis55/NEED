"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { JobRequest, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import Link from "next/link";
import ReportModal from "@/components/ReportModal";
import BackButton from "@/components/BackButton";
import UserAvatar from "@/components/UserAvatar";
import { 
  Wrench, 
  MapPin, 
  Clock, 
  MessageSquare, 
  Calendar, 
  X, 
  CheckCircle, 
  Play, 
  Navigation, 
  PhoneCall, 
  AlertTriangle, 
  ShieldAlert, 
  DollarSign, 
  ExternalLink,
  ChevronRight,
  FileCheck,
  Sparkles
} from "lucide-react";
import { formatDateTime12Hour, to12HourFormat } from "@/utils/formatTime";
import BrutalCelebrationIcon from "@/components/BrutalCelebrationIcon";
import { apiFetch } from "@/utils/apiBase";
import { getSessionId } from "@/utils/sessionId";

export default function TechnicianManageJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const { showAlert } = useAlert();

  const [job, setJob] = useState<JobRequest | null>(() => {
    if (typeof window === "undefined" || !jobId) return null;
    try {
      const cached = sessionStorage.getItem(`need_tech_job_cache_${jobId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [customer, setCustomer] = useState<UserAccount | null>(() => {
    if (typeof window === "undefined" || !jobId) return null;
    try {
      const cached = sessionStorage.getItem(`need_tech_customer_${jobId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined" || !jobId) return true;
    try {
      return !sessionStorage.getItem(`need_tech_job_cache_${jobId}`);
    } catch {
      return true;
    }
  });
  const [promoDaysLeft, setPromoDaysLeft] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Modals & form state
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelCategory, setCancelCategory] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const TECHNICIAN_CANCEL_CATEGORIES = [
    { value: "customer_unresponsive", label: "Customer unreachable / unresponsive" },
    { value: "location_inaccessible", label: "Location inaccessible / too far / unsafe" },
    { value: "scope_mismatch", label: "Scope of work differs significantly from description" },
    { value: "emergency_equipment", label: "Equipment breakdown / personal emergency" },
    { value: "pricing_disagreement", label: "Unable to reach agreement on counter-offer terms" },
    { value: "schedule_conflict", label: "Scheduling overlap / emergency conflict" },
    { value: "other", label: "Other reason" },
  ];

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const [reportingJob, setReportingJob] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    let unsubUser: (() => void) | undefined;
    const unsubJob = onSnapshot(doc(db, "jobRequests", jobId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = { ...docSnap.data(), requestId: docSnap.id } as JobRequest;
        if (isMounted) {
          setJob(data);
          try {
            sessionStorage.setItem(`need_tech_job_cache_${jobId}`, JSON.stringify(data));
          } catch {}
        }

        // Fetch customer profile
        if (data.customerId) {
          try {
            const userSnap = await getDoc(doc(db, "users", data.customerId));
            if (userSnap.exists() && isMounted) {
              const custData = userSnap.data() as UserAccount;
              setCustomer(custData);
              try {
                sessionStorage.setItem(`need_tech_customer_${jobId}`, JSON.stringify(custData));
              } catch {}
            }
          } catch (e) {
            console.error("Failed to fetch customer data", e);
          }
        }
      } else {
        if (isMounted) {
          showAlert("Job request not found", "error");
          router.push("/technician/jobs");
        }
      }
      if (isMounted) setLoading(false);
    }, (err) => {
      console.error("Error loading job:", err);
      if (isMounted) setLoading(false);
    });

    // Check technician verification & promo
    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, "artisans", user.uid)).then((artSnap) => {
        if (artSnap.exists()) {
          const artData = artSnap.data();
          setIsVerified(artData.verified || false);
          if (artData.createdAt) {
            const createdAtMs = typeof artData.createdAt === "number" 
              ? artData.createdAt 
              : artData.createdAt.toMillis?.() || Date.now();
            const daysSinceSignup = Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24));
            setPromoDaysLeft(Math.max(0, 30 - daysSinceSignup));
          }
        }
      });
    }

    return () => {
      unsubJob();
      if (unsubUser) unsubUser();
    };
  }, [jobId, router, showAlert]);

  const handleUpdateStatus = async (newStatus: JobRequest['status'], extraPayload?: Partial<JobRequest>) => {
    if (!job) return;

    if ((newStatus === 'accepted' || newStatus === 'countered') && !isVerified) {
      showAlert("Your account must be approved by an administrator before you can accept or counter jobs.", "error");
      return;
    }

    setSubmittingAction(true);
    try {
      const user = auth.currentUser;
      const requiresDeposit = !job.depositPaid || job.depositStatus !== "held";
      const updatePayload: Partial<JobRequest> = {
        status: newStatus,
        state: newStatus === "accepted" && requiresDeposit ? "awaiting_deposit" : (newStatus as any),
        ...(newStatus === "accepted" && requiresDeposit ? { depositStatus: "pending" } : {}),
        ...(newStatus === "accepted" ? { acceptedAt: Date.now() } : {}),
        updatedAt: Date.now(),
        ...extraPayload
      };

      if (job.isBroadcast && user && !job.artisanId) {
        updatePayload.artisanId = user.uid;

        // Auto-add trade & subcategory to technician profile if not already present
        try {
          const artisanRef = doc(db, "artisans", user.uid);
          const artisanSnap = await getDoc(artisanRef);
          if (artisanSnap.exists()) {
            const artData = artisanSnap.data();
            const currentServices: any[] = artData.services || (artData.trade && artData.subcategory ? [{ trade: artData.trade, subcategory: artData.subcategory }] : []);
            const alreadyHas = currentServices.some((s: any) => s.trade === job.trade && s.subcategory === job.subcategory);
            if (!alreadyHas && job.trade && job.subcategory) {
              const newServices = [
                ...currentServices,
                {
                  trade: job.trade,
                  subcategory: job.subcategory,
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

      await updateDoc(doc(db, "jobRequests", job.requestId), updatePayload);
      showAlert(`Job updated: ${newStatus.replace('_', ' ').toUpperCase()}`, "success");
    } catch (err: any) {
      console.error("Status update failed:", err);
      showAlert(err.message || "Failed to update job status", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(counterAmount.replace(/,/g, ''), 10);
    if (isNaN(val) || val <= 0) {
      showAlert("Please enter a valid counter amount", "error");
      return;
    }

    await handleUpdateStatus("countered", {
      counterOfferAmount: val,
      lastCounterBy: "artisan"
    });
    setShowCounterModal(false);
    setCounterAmount("");
  };

  const handleConfirmCancel = async () => {
    if (!cancelCategory || !cancelReason.trim()) {
      showAlert("Please select a reason category and provide a detailed explanation.", "error");
      return;
    }

    const catObj = TECHNICIAN_CANCEL_CATEGORIES.find(c => c.value === cancelCategory);
    const catLabel = catObj?.label || "Other";
    const combinedReason = `[${catLabel}] ${cancelReason.trim()}`;

    await handleUpdateStatus("cancelled", {
      cancelledBy: "artisan",
      cancelledReason: combinedReason,
      cancelReasonCode: cancelCategory,
      cancelledAt: Date.now()
    });
    setShowCancelModal(false);
    setCancelCategory("");
    setCancelReason("");
  };

  const handleSendReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      showAlert("Please provide both a date and time.", "error");
      return;
    }

    try {
      await updateDoc(doc(db, "jobRequests", job!.requestId), {
        rescheduledAt: Date.now(),
        newPreferredTime: `${rescheduleDate} at ${to12HourFormat(rescheduleTime)}`,
        rescheduleRequestedBy: "artisan",
        rescheduleStatus: "pending"
      });
      showAlert("Reschedule request sent to customer!", "success");
      setShowRescheduleModal(false);
    } catch (err: any) {
      showAlert(err.message || "Failed to request reschedule", "error");
    }
  };

  const handleSOS = async () => {
    if (confirm("Are you in immediate danger? This will alert our emergency response safety team.")) {
      try {
        await updateDoc(doc(db, "jobRequests", job!.requestId), {
          sosAlert: true,
          sosTriggeredBy: "artisan",
          sosTriggeredAt: Date.now()
        });
        showAlert("SOS Alert dispatched! Emergency support has been notified.", "success");
      } catch (err) {
        console.error(err);
        showAlert("Failed to trigger SOS", "error");
      }
    }
  };

  const [callingInProgress, setCallingInProgress] = useState(false);

  const handleStartCall = async (callType: "audio" | "video" = "audio") => {
    const user = auth.currentUser;
    if (!user || !job) {
      showAlert("Cannot initiate call at this time.", "error");
      return;
    }
    setCallingInProgress(true);
    showAlert("Connecting in-app voice call...", "success");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("need_active_outgoing_call", job.requestId);
    }
    try {
      const res = await apiFetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.requestId,
          callerId: user.uid,
          callType,
          callerSessionId: getSessionId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "CALL_STATE_GATE") {
          showAlert(data.error || "Calls are not permitted for this job.", "error");
        } else if (data.code === "CALL_ACTIVE") {
          showAlert("A call is already active on this job.", "error");
        } else {
          showAlert(data.error || "Failed to start in-app call", "error");
        }
      }
    } catch (err: any) {
      console.error("Failed to start in-app call", err);
      showAlert("Failed to connect in-app call", "error");
    } finally {
      setCallingInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center p-4">
        <GlobalSpinner text="LOADING BOOKING DETAILS" />
      </div>
    );
  }

  if (!job) return null;

  const currentStatus = String(job.status || job.state || "pending");
  const currentPrice = (currentStatus === "countered" && job.counterOfferAmount) 
    ? job.counterOfferAmount 
    : (job.offerAmount || (job.agreedPrice ? Math.round(job.agreedPrice / 100) : 0));

  const isAwaitingCustDeposit = (job.status === "accepted" || currentStatus === "accepted") && 
    (job.state === "awaiting_deposit" || job.depositStatus === "pending" || (!job.depositPaid && job.depositStatus !== "held"));

  const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
  const platformFeeRate = isPromoActive ? 0 : 0.20;
  const platformFee = currentPrice * platformFeeRate;
  const artisanTakeHome = currentPrice - platformFee;

  // Timeline Progress
  const statusSteps = [
    { key: "pending", label: "Requested" },
    { key: "accepted", label: "Accepted" },
    { key: "en_route", label: "En Route" },
    { key: "arrived", label: "Arrived" },
    { key: "in_progress", label: "In Progress" },
    { key: "payment_pending", label: "Payment" },
    { key: "completed", label: "Completed" }
  ];

  const currentStepIndex = statusSteps.findIndex(s => s.key === currentStatus);

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header Bar */}
      <div className="px-3.5 sm:px-6 py-2.5 sm:py-3.5 bg-[var(--color-brutal-yellow)] border-b-4 border-black shadow-[0_4px_0_0_#000] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <BackButton className="bg-white text-black brutal-border hover:-translate-y-0.5 active:translate-y-0 transition-all w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center p-0 shrink-0 shadow-[2px_2px_0_0_#000]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] sm:text-xs font-black uppercase bg-black text-white px-1.5 py-0.5 border border-black shrink-0">
                  #{job.requestId.slice(-6).toUpperCase()}
                </span>
                <span className="text-[10px] sm:text-xs font-black uppercase text-gray-800 shrink-0">
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-xs sm:text-base md:text-xl font-black text-black uppercase tracking-tight truncate leading-tight">
                {job.trade} - {job.subcategory}
              </h1>
            </div>
          </div>

          <div className="shrink-0">
            <span className={`px-2 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black uppercase border-2 sm:border-3 border-black shadow-[2px_2px_0_0_#000] whitespace-nowrap inline-block ${
              isAwaitingCustDeposit ? 'bg-[var(--color-brutal-yellow)] text-black border-2 sm:border-3 border-black' :
              currentStatus === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' :
              currentStatus === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' :
              currentStatus === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' :
              currentStatus === 'en_route' ? 'bg-[var(--color-brutal-teal)] text-black' :
              currentStatus === 'arrived' ? 'bg-[var(--color-brutal-teal)] text-black' :
              currentStatus === 'in_progress' ? 'bg-[#bbf7d0] text-black' :
              currentStatus === 'completed' ? 'bg-[var(--color-brutal-green)] text-black' :
              currentStatus === 'declined' ? 'bg-[var(--color-brutal-red)] text-white' :
              'bg-gray-800 text-white'
            }`}>
              {isAwaitingCustDeposit 
                ? 'AWAITING DEPOSIT'
                : currentStatus.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Progress Tracker (Full Width) */}
        {!["cancelled", "declined"].includes(currentStatus) && (
          <div className="bg-white border-4 border-black p-6 mb-8 shadow-[6px_6px_0_0_#000]">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6">Booking Progression</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {statusSteps.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div 
                    key={step.key}
                    className={`p-3 border-3 border-black text-center flex flex-col items-center justify-center transition-all ${
                      isCurrent 
                        ? 'bg-[var(--color-brutal-yellow)] shadow-[3px_3px_0_0_#000] scale-105 font-black' 
                        : isPassed 
                          ? 'bg-[var(--color-brutal-teal)] text-black font-bold' 
                          : 'bg-gray-100 text-gray-400 font-medium'
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wider">{idx + 1}. {step.label}</span>
                    {isPassed && <span className="text-xs font-black mt-0.5">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Work Area (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">

            {/* ACTION BANNER: PRIMARY ACTIONS BY STATUS */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-6 flex items-center justify-between">
                <span>Action Required</span>
                <span className="text-xs bg-black text-white px-2 py-1">Step {currentStepIndex + 1} of 7</span>
              </h2>

              {/* Status: Pending or Countered (Needs Acceptance or Counter) */}
              {(currentStatus === "pending" || (currentStatus === "countered" && job.lastCounterBy === "customer")) && (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--color-brutal-yellow)] border-3 border-black mb-4">
                    <p className="font-black uppercase text-sm">
                      {job.isBroadcast ? "Broadcast request available for pickup." : "Customer is awaiting your response."}
                    </p>
                    <p className="text-xs font-bold mt-1 text-gray-800">
                      Offered Amount: ₦{currentPrice.toLocaleString()} • Take Home: ₦{artisanTakeHome.toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleUpdateStatus("accepted")}
                      disabled={submittingAction}
                      className="py-4 bg-[var(--color-brutal-green)] text-black font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50"
                    >
                      ACCEPT (₦{currentPrice.toLocaleString()})
                    </button>

                    <button
                      onClick={() => setShowCounterModal(true)}
                      disabled={submittingAction}
                      className="py-4 bg-[var(--color-brutal-yellow)] text-black font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50"
                    >
                      COUNTER OFFER
                    </button>

                    <button
                      onClick={() => handleUpdateStatus("declined", { declinedBy: "artisan" })}
                      disabled={submittingAction}
                      className="py-4 bg-[var(--color-brutal-red)] text-white font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50"
                    >
                      DECLINE
                    </button>
                  </div>
                </div>
              )}

              {/* Status: Countered by Technician (Waiting for Customer) */}
              {currentStatus === "countered" && job.lastCounterBy === "artisan" && (
                <div className="p-6 bg-[var(--color-brutal-pink)] border-3 border-black text-center">
                  <p className="font-black uppercase text-lg mb-2">Counter offer of ₦{currentPrice.toLocaleString()} sent!</p>
                  <p className="text-sm font-bold text-gray-800">Awaiting customer response to accept or counter.</p>
                </div>
              )}

              {/* Status: Accepted */}
              {currentStatus === "accepted" && isAwaitingCustDeposit ? (
                <div className="p-6 bg-[var(--color-brutal-yellow)] border-4 border-black space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-black bg-white px-2.5 py-1 border-2 border-black inline-block">
                    <Clock className="w-3.5 h-3.5" /> AWAITING CUSTOMER ESCROW DEPOSIT
                  </div>
                  <h3 className="text-xl font-black uppercase text-black">Job Accepted • Stand By To Travel</h3>
                  <p className="text-sm font-bold text-gray-800 leading-relaxed">
                    You have accepted this booking. The customer has been prompted to fund their 25% commitment deposit into escrow. As soon as payment is confirmed, you will be notified to travel.
                  </p>
                </div>
              ) : currentStatus === "accepted" ? (
                <div className="space-y-4">
                  <p className="font-bold text-sm text-gray-700 mb-2 uppercase">
                    Escrow deposit confirmed! When you are ready to travel, tap below to notify the customer and enable live GPS tracking.
                  </p>
                  <button
                    onClick={() => handleUpdateStatus("en_route")}
                    disabled={submittingAction}
                    className="w-full py-5 bg-[var(--color-brutal-blue)] text-white font-black text-xl uppercase tracking-widest border-4 border-black shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5 transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Navigation className="w-6 h-6 stroke-[3]" />
                    <span>I&apos;M ON MY WAY</span>
                  </button>
                </div>
              ) : null}

              {/* Status: En Route */}
              {currentStatus === "en_route" && (
                <div className="space-y-4">
                  <p className="font-bold text-sm text-gray-700 mb-2 uppercase">
                    You are en route to the customer location. Once you arrive at the address, tap below to confirm your arrival.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link
                      href={`/technician/jobs/${job.requestId}/navigate`}
                      className="py-4 bg-black text-white font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2 text-center"
                    >
                      <MapPin className="w-5 h-5" />
                      <span>TURN-BY-TURN GPS</span>
                    </Link>
                    <button
                      onClick={() => handleUpdateStatus("arrived")}
                      disabled={submittingAction}
                      className="py-4 bg-[var(--color-brutal-teal)] text-black font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5 stroke-[3]" />
                      <span>I HAVE ARRIVED</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Status: Arrived (Ready to Start) */}
              {currentStatus === "arrived" && (
                <div className="space-y-4">
                  <p className="font-bold text-sm text-gray-700 mb-2 uppercase">
                    You have arrived at the customer&apos;s site. When you commence work, tap Start Job to initiate the job clock.
                  </p>
                  <button
                    onClick={() => handleUpdateStatus("in_progress")}
                    disabled={submittingAction}
                    className="w-full py-5 bg-[var(--color-brutal-green)] text-black font-black text-xl uppercase tracking-widest border-4 border-black shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5 transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <Play className="w-6 h-6 stroke-[3]" />
                    <span>START JOB</span>
                  </button>
                </div>
              )}

              {/* Status: In Progress */}
              {currentStatus === "in_progress" && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#bbf7d0] border-3 border-black">
                    <p className="font-black uppercase text-sm">Work is currently in progress.</p>
                    <p className="text-xs font-bold text-gray-800 mt-1">
                      Complete the agreed scope of work. Once finished, mark the job as completed to prompt payment.
                    </p>
                  </div>

                  <button
                    onClick={() => handleUpdateStatus("payment_pending")}
                    disabled={submittingAction}
                    className="w-full py-5 bg-[var(--color-brutal-yellow)] text-black font-black text-xl uppercase tracking-widest border-4 border-black shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5 transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <CheckCircle className="w-6 h-6 stroke-[3]" />
                    <span>MARK JOB AS FINISHED</span>
                  </button>
                </div>
              )}

              {/* Status: Payment Pending */}
              {currentStatus === "payment_pending" && (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--color-brutal-yellow)] border-3 border-black">
                    <p className="font-black uppercase text-sm mb-2">Job Marked Finished — Awaiting Payment</p>
                    <p className="text-xs font-bold text-gray-800">
                      The customer has been notified to settle the agreed amount of ₦{currentPrice.toLocaleString()}.
                    </p>
                  </div>

                  {job.proofOfPaymentUrl && (
                    <div className="border-3 border-black p-4 bg-gray-50">
                      <p className="font-black uppercase text-xs text-gray-600 mb-2">Customer Uploaded Proof of Payment</p>
                      <a 
                        href={job.proofOfPaymentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-white px-4 py-2 border-2 border-black font-black uppercase text-sm hover:bg-[var(--color-brutal-yellow)] transition-colors shadow-[2px_2px_0_0_#000]"
                      >
                        <FileCheck className="w-4 h-4" />
                        <span>VIEW RECEIPT IMAGE</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <button
                    onClick={() => handleUpdateStatus("completed")}
                    disabled={submittingAction}
                    className="w-full py-5 bg-[var(--color-brutal-green)] text-black font-black text-xl uppercase tracking-widest border-4 border-black shadow-[6px_6px_0_0_#000] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5 transition-all flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <CheckCircle className="w-6 h-6 stroke-[3]" />
                    <span>CONFIRM PAYMENT RECEIVED</span>
                  </button>
                </div>
              )}

              {/* Status: Completed */}
              {currentStatus === "completed" && (
                <div className="p-6 sm:p-8 bg-[var(--color-brutal-green)] border-4 border-black text-center shadow-[4px_4px_0_0_#000]">
                  <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white border-4 border-black shadow-[4px_4px_0_0_#000] -rotate-2 mx-auto mb-4 p-2">
                    <BrutalCelebrationIcon className="w-12 h-12 sm:w-14 sm:h-14" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mb-1.5">
                    Job Fully Completed!
                  </h3>
                  <p className="text-xs sm:text-sm font-black text-black uppercase max-w-md mx-auto">
                    Payment of ₦{currentPrice.toLocaleString()} confirmed. Net earnings of ₦{artisanTakeHome.toLocaleString()} credited.
                  </p>
                </div>
              )}

              {/* Status: Cancelled or Declined */}
              {currentStatus === "cancelled" && (
                <div className="p-6 bg-gray-900 text-white border-3 border-black">
                  <p className="font-black text-xl uppercase text-red-400 mb-1">Job Cancelled</p>
                  <p className="text-sm font-medium">{job.cancelledReason || "This job was cancelled."}</p>
                </div>
              )}

              {currentStatus === "declined" && (
                <div className="p-6 bg-[var(--color-brutal-red)] text-white border-3 border-black">
                  <p className="font-black text-xl uppercase mb-1">Job Declined</p>
                  <p className="text-sm font-medium">This job request was declined and closed.</p>
                </div>
              )}
            </div>

            {/* JOB DETAILS & SCOPE CARD */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-6">
                Scope & Requirements
              </h2>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Service Type</p>
                  <p className="font-black text-2xl uppercase text-black">{job.trade} • {job.subcategory}</p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Customer Description</p>
                  <div className="p-4 bg-[var(--color-brutal-bg)] border-3 border-black">
                    <p className="font-bold text-black text-base whitespace-pre-wrap">{job.description || "No additional description provided."}</p>
                  </div>
                </div>

                {job.mediaUrl && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Attached Photo / Video</p>
                    <div className="p-4 bg-white border-3 border-black">
                      {job.mediaUrl.match(/\.(mp4|webm|mov|ogg)/i) ? (
                        <video 
                          src={job.mediaUrl} 
                          controls 
                          className="max-h-80 w-full object-contain brutal-border bg-black"
                        />
                      ) : (
                        <a href={job.mediaUrl} target="_blank" rel="noopener noreferrer" className="block group">
                          <img 
                            src={job.mediaUrl} 
                            alt="Job attachment" 
                            className="max-h-80 w-full object-contain brutal-border bg-black group-hover:opacity-90 transition-opacity" 
                          />
                          <p className="text-xs font-black uppercase mt-2 text-blue-600 underline">Click to view full resolution</p>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-gray-50 border-3 border-black">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Preferred Schedule
                    </p>
                    <p className="font-black text-lg text-black uppercase">{formatDateTime12Hour(job.preferredTime) || "Flexible"}</p>
                  </div>

                  <div className="p-4 bg-gray-50 border-3 border-black">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> Date Requested
                    </p>
                    <p className="font-black text-lg text-black uppercase">
                      {new Date(job.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* LOCATION & ROUTING CARD */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-6 flex items-center justify-between">
                <span>Customer Location</span>
                <MapPin className="w-5 h-5 text-[var(--color-brutal-pink)]" />
              </h2>

              <div className="space-y-4">
                <div className="p-4 bg-[var(--color-brutal-bg)] border-3 border-black space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Neighborhood & Destination</p>
                  <p className="font-black text-xl uppercase text-black">{job.neighborhood || "Location on record"}</p>
                  {job.locationCoords?.lat && job.locationCoords?.lng && (job.locationCoords.lat !== 0 || job.locationCoords.lng !== 0) ? (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] font-black uppercase bg-[var(--color-brutal-green)] text-black px-2 py-0.5 border-2 border-black inline-block">
                        GPS Verified: {job.locationCoords.lat.toFixed(6)}, {job.locationCoords.lng.toFixed(6)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-gray-500 uppercase">Approximate area</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href={`/technician/jobs/${job.requestId}/navigate`}
                    className="flex-1 py-4 bg-black text-white font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-[var(--color-brutal-blue)] hover:text-black transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-5 h-5" />
                    <span>APP NAVIGATION</span>
                  </Link>

                  <a
                    href={
                      job.locationCoords?.lat && job.locationCoords?.lng && (job.locationCoords.lat !== 0 || job.locationCoords.lng !== 0)
                        ? `https://www.google.com/maps/dir/?api=1&destination=${job.locationCoords.lat},${job.locationCoords.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.neighborhood || "Lagos Nigeria")}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-4 bg-white text-black font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-[var(--color-brutal-yellow)] transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>OPEN IN GOOGLE MAPS</span>
                  </a>
                </div>
              </div>
            </div>

            {/* RESCHEDULE MANAGEMENT */}
            {["accepted", "en_route"].includes(currentStatus) && (
              <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
                <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-4 flex items-center justify-between">
                  <span>Schedule & Rescheduling</span>
                  <Calendar className="w-5 h-5" />
                </h2>

                {job.rescheduleStatus === "pending" ? (
                  job.rescheduleRequestedBy === "customer" ? (
                    <div className="bg-[var(--color-brutal-yellow)] p-4 border-3 border-black">
                      <p className="font-black text-black uppercase mb-2">
                        Customer requested to reschedule to: <br />
                        <span className="text-lg underline">{formatDateTime12Hour(job.newPreferredTime)}</span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await updateDoc(doc(db, "jobRequests", job.requestId), {
                              rescheduleStatus: "accepted",
                              preferredTime: job.newPreferredTime
                            });
                            showAlert("Reschedule accepted!", "success");
                          }}
                          className="flex-1 bg-[var(--color-brutal-green)] text-black border-2 border-black font-black uppercase py-2 shadow-[2px_2px_0_0_#000]"
                        >
                          Accept
                        </button>
                        <button
                          onClick={async () => {
                            await updateDoc(doc(db, "jobRequests", job.requestId), {
                              rescheduleStatus: "declined"
                            });
                            showAlert("Reschedule declined.", "error");
                          }}
                          className="flex-1 bg-[var(--color-brutal-red)] text-white border-2 border-black font-black uppercase py-2 shadow-[2px_2px_0_0_#000]"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-100 border-3 border-black text-center font-bold text-sm uppercase">
                      Waiting for customer to confirm your reschedule proposal.
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => setShowRescheduleModal(true)}
                    className="w-full py-3 bg-[var(--color-brutal-yellow)] border-3 border-black font-black uppercase tracking-widest text-sm hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]"
                  >
                    REQUEST A RESCHEDULE
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Area (Right Column) */}
          <div className="space-y-6">

            {/* FINANCIAL CARD */}
            <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <p className="text-xs font-black uppercase tracking-widest text-black mb-1">Financial Overview</p>
              <h2 className="text-4xl md:text-5xl font-black text-black tracking-tighter">₦{currentPrice.toLocaleString()}</h2>

              <div className="mt-6 space-y-2 border-t-3 border-black pt-4">
                <div className="flex justify-between text-sm font-black uppercase text-gray-800">
                  <span>Gross Job Amount</span>
                  <span>₦{currentPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-black uppercase text-[var(--color-brutal-red)]">
                  <span>Platform Fee {isPromoActive ? "(0% PROMO)" : "(20%)"}</span>
                  <span>{isPromoActive ? "FREE" : `-₦${platformFee.toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-lg font-black uppercase text-black border-t-2 border-dashed border-black pt-2">
                  <span>Your Take Home</span>
                  <span className="text-black bg-white px-2 py-0.5 border-2 border-black shadow-[2px_2px_0_0_#000]">
                    ₦{artisanTakeHome.toLocaleString()}
                  </span>
                </div>
              </div>

              {isPromoActive && (
                <div className="mt-4 bg-white border-2 border-black p-2 text-center text-xs font-black uppercase text-[var(--color-brutal-teal)] flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 fill-[var(--color-brutal-teal)] text-[var(--color-brutal-teal)]" />
                  <span>Promotional 0% Platform Fee Active ({promoDaysLeft} days left)</span>
                </div>
              )}
            </div>

            {/* CUSTOMER PROFILE & CONTACT CARD */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 border-b-2 border-black pb-2">
                Customer Information
              </h3>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full border-3 border-black overflow-hidden bg-[var(--color-brutal-yellow)] shrink-0">
                  <UserAvatar photoURL={customer?.photoURL} name={customer?.displayName || customer?.firstName || "Customer"} className="w-full h-full text-xl font-black" />
                </div>
                <div>
                  <p className="font-black text-xl text-black uppercase leading-tight">
                    {customer?.displayName || (customer?.firstName ? `${customer.firstName} ${customer.lastName || ''}` : "Customer")}
                  </p>
                  <p className="text-xs font-bold text-gray-500 uppercase mt-0.5">Verified NEED Customer</p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href={`/chat/${job.requestId}`}
                  className="w-full py-4 bg-[var(--color-brutal-teal)] text-black font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2 block"
                >
                  <MessageSquare className="w-5 h-5 stroke-[2.5]" />
                  <span>CHAT WITH CUSTOMER</span>
                </Link>

                {["accepted", "en_route", "arrived", "in_progress"].includes(currentStatus) && (
                  <button
                    type="button"
                    onClick={() => handleStartCall("audio")}
                    disabled={callingInProgress}
                    className="w-full py-3.5 bg-white text-black font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <PhoneCall className="w-5 h-5 stroke-[2.5]" />
                    <span>{callingInProgress ? "CONNECTING CALL..." : "IN-APP VOICE CALL"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* SAFETY & INCIDENT ACTIONS */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 border-b-2 border-black pb-2">
                Safety & Options
              </h3>

              {currentStatus === "in_progress" && (
                <button
                  onClick={handleSOS}
                  className="w-full py-3 bg-red-600 text-white font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5" />
                  <span>EMERGENCY SOS PANIC</span>
                </button>
              )}

              {["pending", "accepted", "en_route"].includes(currentStatus) && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full py-3 bg-[var(--color-brutal-red)] text-white font-black uppercase tracking-widest text-xs border-3 border-black shadow-[3px_3px_0_0_#000] hover:bg-black transition-all flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4 stroke-[3]" />
                  <span>CANCEL THIS BOOKING</span>
                </button>
              )}

              <button
                onClick={() => setReportingJob(true)}
                className="w-full py-2.5 bg-gray-100 text-black font-black uppercase tracking-widest text-xs border-2 border-black hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>REPORT AN ISSUE</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* COUNTER OFFER MODAL */}
      {showCounterModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border-4 border-black max-w-md w-full shadow-[8px_8px_0_0_var(--color-brutal-yellow)] relative">
            <button 
              onClick={() => setShowCounterModal(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] transition-colors"
            >
              <X className="w-8 h-8 stroke-[3]" />
            </button>
            
            <div className="p-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-2">
                Make Counter Offer
              </h2>
              
              <form onSubmit={handleSendCounter} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1">
                    Your Proposed Amount (₦)
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="1000"
                    placeholder="e.g. 15000"
                    value={counterAmount}
                    onChange={e => setCounterAmount(e.target.value)}
                    required
                    className="w-full p-4 border-4 border-black font-black text-3xl focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors"
                  />
                </div>

                <div className="p-3 bg-[var(--color-brutal-bg)] border-2 border-black text-xs font-black uppercase space-y-1">
                  <p className="flex justify-between">
                    <span>Platform Fee Cut:</span>
                    <span>{isPromoActive ? "FREE" : "-20%"}</span>
                  </p>
                  <p className="flex justify-between text-[var(--color-brutal-teal)]">
                    <span>Your Net Take Home:</span>
                    <span>₦{(parseInt(counterAmount || "0", 10) * (isPromoActive ? 1 : 0.8)).toLocaleString()}</span>
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCounterModal(false)}
                    className="flex-1 py-3 bg-white border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction || !counterAmount}
                    className="flex-1 py-3 bg-[var(--color-brutal-teal)] text-black border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000] hover:bg-black hover:text-white transition-all disabled:opacity-50"
                  >
                    Send Offer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border-4 border-black max-w-md w-full shadow-[8px_8px_0_0_var(--color-brutal-red)] relative">
            <button 
              onClick={() => setShowCancelModal(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] transition-colors"
            >
              <X className="w-8 h-8 stroke-[3]" />
            </button>
            
            <div className="p-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 border-b-4 border-black pb-2 text-red-600">
                Cancel Booking
              </h2>
              
              <p className="text-xs font-bold text-gray-700 mb-4 uppercase">
                Please complete this cancellation survey so our operations team can reassign the customer or review terms.
              </p>

              {/* Reason Category Dropdown */}
              <div className="mb-4">
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Reason Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={cancelCategory}
                  onChange={e => setCancelCategory(e.target.value)}
                  className="w-full p-3 border-4 border-black font-bold text-sm bg-white focus:outline-none cursor-pointer shadow-[2px_2px_0_0_#000]"
                >
                  <option value="">-- Select a reason category --</option>
                  {TECHNICIAN_CANCEL_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mandatory Explanation Field */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-black uppercase tracking-wider">
                    Detailed Explanation <span className="text-red-600">*</span>
                  </label>
                  <span className="text-[10px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5 border border-red-600">
                    Required
                  </span>
                </div>
                <p className="text-[11px] font-bold text-gray-500 mb-1.5">
                  Even when selecting a category above, you must type out an explanation before cancelling.
                </p>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Please specify why you need to cancel this booking..."
                  className="w-full p-3 border-4 border-black font-bold text-sm min-h-[100px] focus:outline-none shadow-[2px_2px_0_0_#000]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelCategory("");
                    setCancelReason("");
                  }}
                  className="flex-1 py-3 bg-white border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000] hover:bg-gray-100"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={submittingAction || !cancelCategory || !cancelReason.trim()}
                  className="flex-1 py-3 bg-[var(--color-brutal-red)] text-white border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000] hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border-4 border-black max-w-md w-full shadow-[8px_8px_0_0_var(--color-brutal-yellow)] relative">
            <button 
              onClick={() => setShowRescheduleModal(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] transition-colors"
            >
              <X className="w-8 h-8 stroke-[3]" />
            </button>
            
            <div className="p-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-2">
                Reschedule Job
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1">New Date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={e => setRescheduleDate(e.target.value)}
                    className="w-full p-3 border-3 border-black font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1">New Time</label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={e => setRescheduleTime(e.target.value)}
                    className="w-full p-3 border-3 border-black font-bold"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRescheduleModal(false)}
                    className="flex-1 py-3 bg-white border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReschedule}
                    disabled={!rescheduleDate || !rescheduleTime}
                    className="flex-1 py-3 bg-[var(--color-brutal-green)] text-black border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000] hover:bg-black hover:text-white transition-all disabled:opacity-50"
                  >
                    Propose Time
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {reportingJob && auth.currentUser && (
        <ReportModal 
          jobId={job.requestId}
          reportedUserId={job.customerId}
          reporterUserId={auth.currentUser.uid}
          reporterRole="artisan"
          onClose={() => setReportingJob(false)}
        />
      )}
    </div>
  );
}
