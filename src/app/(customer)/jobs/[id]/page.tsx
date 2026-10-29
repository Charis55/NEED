"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc, runTransaction, collection } from "firebase/firestore";
import { JobRequest, ArtisanProfile, UserAccount } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import AuthGate from "@/components/AuthGate";
import Link from "next/link";
import ReportModal from "@/components/ReportModal";
import BackButton from "@/components/BackButton";
import UserAvatar from "@/components/UserAvatar";
import { 
  AlertTriangle, 
  Wrench, 
  MapPin, 
  Clock, 
  MessageSquare, 
  Calendar, 
  X, 
  Star, 
  CheckCircle, 
  RefreshCw, 
  FileText, 
  PhoneCall, 
  Award, 
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Navigation
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { formatDateTime12Hour, to12HourFormat } from "@/utils/formatTime";
import { reverseGeocode, geocode } from "@/utils/location";
import BrutalCelebrationIcon from "@/components/BrutalCelebrationIcon";
import { apiFetch } from "@/utils/apiBase";
import { getSessionId } from "@/utils/sessionId";

export default function CustomerManageJobPage() {
  return (
    <AuthGate title="Sign in to view booking" description="Create a free account to track and manage your bookings.">
      <JobsContent />
    </AuthGate>
  );
}

function JobsContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const { showAlert } = useAlert();

  const [job, setJob] = useState<JobRequest | null>(() => {
    if (typeof window === "undefined" || !jobId) return null;
    try {
      const cached = sessionStorage.getItem(`need_job_cache_${jobId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(() => {
    if (typeof window === "undefined" || !jobId) return null;
    try {
      const cached = sessionStorage.getItem(`need_job_artisan_${jobId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [artisanUser, setArtisanUser] = useState<UserAccount | null>(() => {
    if (typeof window === "undefined" || !jobId) return null;
    try {
      const cached = sessionStorage.getItem(`need_job_artisan_user_${jobId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined" || !jobId) return true;
    try {
      return !sessionStorage.getItem(`need_job_cache_${jobId}`);
    } catch {
      return true;
    }
  });

  // Actions state
  const [counterInput, setCounterInput] = useState("");
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [reviewingJob, setReviewingJob] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [cancellingJob, setCancellingJob] = useState(false);
  const [cancelCategory, setCancelCategory] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const CUSTOMER_CANCEL_CATEGORIES = [
    { value: "artisan_delayed", label: "Artisan running late / unresponsive / no-show" },
    { value: "found_alternative", label: "Found another artisan / resolved the issue myself" },
    { value: "price_unacceptable", label: "Price / counter-offer was too high" },
    { value: "requirements_changed", label: "Job requirements changed / no longer needed" },
    { value: "schedule_conflict", label: "Schedule conflict / personal emergency" },
    { value: "booked_by_mistake", label: "Booked by mistake" },
    { value: "other", label: "Other reason" },
  ];

  const [reschedulingJob, setReschedulingJob] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const [claimingGuarantee, setClaimingGuarantee] = useState(false);
  const [guaranteeDescription, setGuaranteeDescription] = useState("");
  const [guaranteePhotoUrl, setGuaranteePhotoUrl] = useState("");
  const [submittingGuarantee, setSubmittingGuarantee] = useState(false);

  const [reportingJob, setReportingJob] = useState(false);
  const [callingInProgress, setCallingInProgress] = useState(false);
  const [payingDeposit, setPayingDeposit] = useState(false);

  // Customer Location Update Modal State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;
    const unsubJob = onSnapshot(doc(db, "jobRequests", jobId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = { ...docSnap.data(), requestId: docSnap.id } as JobRequest;
        if (isMounted) {
          setJob(data);
          try {
            sessionStorage.setItem(`need_job_cache_${jobId}`, JSON.stringify(data));
          } catch {}
        }

        // Fetch artisan info
        if (data.artisanId) {
          try {
            const [artDoc, userDoc] = await Promise.all([
              getDoc(doc(db, "artisans", data.artisanId)),
              getDoc(doc(db, "users", data.artisanId))
            ]);
            if (isMounted) {
              if (artDoc.exists()) {
                const artData = artDoc.data() as ArtisanProfile;
                setArtisan(artData);
                try {
                  sessionStorage.setItem(`need_job_artisan_${jobId}`, JSON.stringify(artData));
                } catch {}
              }
              if (userDoc.exists()) {
                const userData = userDoc.data() as UserAccount;
                setArtisanUser(userData);
                try {
                  sessionStorage.setItem(`need_job_artisan_user_${jobId}`, JSON.stringify(userData));
                } catch {}
              }
            }
          } catch (e) {
            console.error("Failed to load artisan info", e);
          }
        }
      } else {
        if (isMounted) {
          showAlert("Booking not found", "error");
          router.push("/jobs");
        }
      }
      if (isMounted) setLoading(false);
    }, (error) => {
      console.error("Error fetching request:", error);
      setLoading(false);
    });

    return () => unsubJob();
  }, [jobId, router, showAlert]);

  const handleUpdateStatus = async (newStatus: JobRequest['status'], counterAmt: number | null = null, reason?: string, reasonCode?: string) => {
    if (!job) return;
    try {
      const reqRef = doc(db, "jobRequests", job.requestId);
      const updatePayload: Partial<JobRequest> = { status: newStatus };

      if (newStatus === "countered") {
        if (!counterAmt) {
          showAlert("Please enter a valid counter offer", "error");
          return;
        }
        updatePayload.counterOfferAmount = counterAmt;
        updatePayload.lastCounterBy = "customer";
      }

      if (newStatus === "declined") {
        updatePayload.declinedBy = "customer";
      }

      if (newStatus === "cancelled") {
        updatePayload.cancelledBy = "customer";
        if (reason) updatePayload.cancelledReason = reason;
        if (reasonCode) (updatePayload as any).cancelReasonCode = reasonCode;
      }

      await updateDoc(reqRef, updatePayload);
      showAlert(`Booking status updated to ${newStatus.replace('_', ' ').toUpperCase()}`, "success");
      setShowCounterModal(false);
      setCancellingJob(false);
      setCancelReason("");
      setCancelCategory("");
    } catch (error) {
      console.error("Failed to update status", error);
      showAlert("Error updating status", "error");
    }
  };

  const handlePayDeposit = async () => {
    const user = auth.currentUser;
    if (!job || !user) {
      showAlert("Please sign in to proceed with payment.", "error");
      return;
    }
    setPayingDeposit(true);
    try {
      const res = await apiFetch("/api/checkout/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: user.uid,
          jobId: job.requestId,
          offerAmount: currentPrice,
          trade: job.trade,
          subcategory: job.subcategory,
          services: job.services || [],
          applyCredits: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize deposit checkout");
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        showAlert("Deposit confirmed via platform credits!", "success");
      }
    } catch (err: any) {
      console.error("Deposit checkout failed:", err);
      showAlert(err.message || "Could not start payment", "error");
    } finally {
      setPayingDeposit(false);
    }
  };

  const handleSOS = async () => {
    if (confirm("Are you in immediate danger? This will alert our safety team and emergency dispatch.")) {
      try {
        await updateDoc(doc(db, "jobRequests", job!.requestId), {
          sosAlert: true,
          sosTriggeredBy: "customer",
          sosTriggeredAt: Date.now()
        });
        showAlert("SOS Alert triggered! Our team has been notified and will contact you immediately.", "success");
      } catch (err) {
        console.error(err);
        showAlert("Failed to trigger SOS", "error");
      }
    }
  };

  const handleRequestReschedule = async () => {
    if (!newDate || !newTime) {
      showAlert("Please select a new date and time", "error");
      return;
    }
    
    try {
      await updateDoc(doc(db, "jobRequests", job!.requestId), {
        rescheduledAt: Date.now(),
        newPreferredTime: `${newDate} at ${to12HourFormat(newTime)}`,
        rescheduleRequestedBy: "customer",
        rescheduleStatus: "pending"
      });
      showAlert("Reschedule request sent to technician!", "success");
      setReschedulingJob(false);
    } catch (err) {
      console.error(err);
      showAlert("Failed to reschedule", "error");
    }
  };

  const handleRespondReschedule = async (decision: "accepted" | "declined", newTimeVal: string) => {
    try {
      if (decision === "accepted") {
        await updateDoc(doc(db, "jobRequests", job!.requestId), {
          rescheduleStatus: "accepted",
          preferredTime: newTimeVal
        });
        showAlert("Reschedule accepted!", "success");
      } else {
        await updateDoc(doc(db, "jobRequests", job!.requestId), {
          rescheduleStatus: "declined"
        });
        showAlert("Reschedule declined.", "error");
      }
    } catch (err) {
      console.error(err);
      showAlert("Failed to process reschedule", "error");
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !job.artisanId) return;

    setSubmittingReview(true);
    try {
      await runTransaction(db, async (transaction) => {
        const artisanRef = doc(db, "artisans", job.artisanId!);
        const artisanDoc = await transaction.get(artisanRef);

        let newCount = 1;
        let newAvg = rating;

        if (artisanDoc.exists()) {
          const artData = artisanDoc.data() as ArtisanProfile;
          const currentCount = artData.ratingCount || 0;
          const currentAvg = artData.ratingAverage || 0;
          newCount = currentCount + 1;
          newAvg = ((currentAvg * currentCount) + rating) / newCount;
        }

        const newReviewRef = doc(collection(db, "reviews"));
        transaction.set(newReviewRef, {
          reviewId: newReviewRef.id,
          requestId: job.requestId,
          artisanId: job.artisanId,
          customerId: job.customerId,
          rating,
          comment,
          createdAt: Date.now()
        });

        transaction.update(artisanRef, {
          ratingCount: newCount,
          ratingAverage: newAvg
        });

        const reqRef = doc(db, "jobRequests", job.requestId);
        transaction.update(reqRef, { reviewed: true });
      });

      showAlert("Review submitted successfully! Thank you.", "success");
      setReviewingJob(false);
    } catch (err) {
      console.error(err);
      showAlert("Failed to submit review", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitGuaranteeClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !auth.currentUser) return;

    setSubmittingGuarantee(true);
    try {
      const res = await apiFetch("/api/guarantee/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.requestId,
          description: guaranteeDescription,
          photoUrl: guaranteePhotoUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit guarantee claim");

      showAlert("30-Day Guarantee claim filed! A moderator will review your case within 24 hours.", "success");
      setClaimingGuarantee(false);
      setGuaranteeDescription("");
      setGuaranteePhotoUrl("");
    } catch (err: any) {
      showAlert(err.message || "Failed to file claim", "error");
    } finally {
      setSubmittingGuarantee(false);
    }
  };

  const handleStartCall = async (callType: "audio" | "video" = "audio") => {
    const user = auth.currentUser;
    if (!user || !job) {
      showAlert("Cannot initiate call at this time.", "error");
      return;
    }
    setCallingInProgress(true);
    showAlert("Connecting in-app voice call...", "success");
    try {
      const {
        getDeviceId,
        getPlatformName,
        generateCallAttemptId,
        setActiveOutgoingCallId,
        safeSetSession,
      } = await import("@/utils/device");

      const attemptId = generateCallAttemptId(job.requestId);
      setActiveOutgoingCallId(attemptId);
      safeSetSession("need_active_outgoing_call_job", job.requestId);

      const res = await apiFetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.requestId,
          attemptId,
          callerId: user.uid,
          callType,
          callerDeviceId: getDeviceId(),
          callerPlatform: getPlatformName(),
          callerSessionId: getSessionId(),
          callerName: user.displayName || "Customer",
          callerPhoto: user.photoURL || null,
          partnerId: job.artisanId,
          receiverName: artisan?.businessName || artisan?.name || artisanUser?.displayName || (artisanUser?.firstName ? `${artisanUser.firstName} ${artisanUser.lastName || ''}`.trim() : null) || "Technician",
          receiverPhoto: artisan?.profilePictureUrl || artisanUser?.photoURL || null,
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
      } else if (data.activeCall && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("needCallInitiated", {
            detail: {
              job: {
                ...job,
                activeCall: data.activeCall,
              },
            },
          })
        );
      }
    } catch (err: any) {
      console.error("Failed to start in-app call", err);
      showAlert("Failed to connect in-app call", "error");
    } finally {
      setCallingInProgress(false);
    }
  };

  const handleDetectLocation = async () => {
    setIsLocating(true);
    setLocationError("");
    try {
      if (Capacitor.isNativePlatform()) {
        const permStatus = await Geolocation.checkPermissions();
        if (permStatus.location !== 'granted') {
          const reqStatus = await Geolocation.requestPermissions();
          if (reqStatus.location !== 'granted') {
            setLocationError("Location permission denied. Please enable GPS permissions.");
            setIsLocating(false);
            return;
          }
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });

      const { latitude, longitude } = position.coords;
      const name = await reverseGeocode(latitude, longitude);
      setDetectedCoords({ lat: latitude, lng: longitude });
      setLocationInput(name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      showAlert("GPS location captured!", "success");
    } catch (err: any) {
      console.error("GPS detection error:", err);
      setLocationError("Could not retrieve GPS coordinates. Please check your device location settings or enter address manually.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    const trimmed = locationInput.trim();
    if (!trimmed && !detectedCoords) {
      setLocationError("Please enter an address or detect your GPS location.");
      return;
    }

    setSavingLocation(true);
    setLocationError("");
    try {
      let finalCoords = detectedCoords;
      let finalName = trimmed;

      if (!finalCoords && trimmed) {
        try {
          const geocoded = await geocode(trimmed);
          if (geocoded && (geocoded.lat !== 0 || geocoded.lng !== 0)) {
            finalCoords = geocoded;
          }
        } catch (geoErr) {
          console.warn("Geocoding failed for manual address:", geoErr);
        }
      }

      const updatePayload: Partial<JobRequest> = {
        neighborhood: finalName || job.neighborhood,
      };

      if (finalCoords && (finalCoords.lat !== 0 || finalCoords.lng !== 0)) {
        updatePayload.locationCoords = finalCoords;
      }

      await updateDoc(doc(db, "jobRequests", job.requestId), updatePayload);
      showAlert("Location updated successfully!", "success");
      setShowLocationModal(false);
    } catch (err: any) {
      console.error("Failed to update location:", err);
      showAlert(err.message || "Failed to update location", "error");
    } finally {
      setSavingLocation(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center p-4">
        <GlobalSpinner text="LOADING YOUR BOOKING" />
      </div>
    );
  }

  if (!job) return null;

  const currentStatus = String(job.status || job.state || "pending");
  const currentPrice = (currentStatus === "countered" && job.counterOfferAmount) 
    ? job.counterOfferAmount 
    : (job.offerAmount || (job.agreedPrice ? Math.round(job.agreedPrice / 100) : 0));

  const isAcceptedAwaitingDeposit = (job.status === "accepted" || currentStatus === "accepted") && 
    (job.state === "awaiting_deposit" || job.depositStatus === "pending" || (!job.depositPaid && job.depositStatus !== "held"));

  const statusSteps = [
    { key: "pending", label: "Requested" },
    { key: "accepted", label: "Accepted" },
    { key: "en_route", label: "En Route" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" }
  ];

  const stepMapping: Record<string, number> = {
    pending: 0,
    countered: 0,
    accepted: 1,
    en_route: 2,
    arrived: 2,
    in_progress: 3,
    payment_pending: 3,
    completed: 4
  };

  const currentStepIndex = stepMapping[currentStatus] ?? 0;

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Header Bar */}
      <div className="px-3.5 sm:px-6 safe-header-top pb-2.5 sm:pb-3.5 bg-[var(--color-brutal-teal)] border-b-4 border-black shadow-[0_4px_0_0_#000] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <BackButton className="bg-white text-black brutal-border hover:-translate-y-0.5 active:translate-y-0 transition-all w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center p-0 shrink-0 shadow-[2px_2px_0_0_#000]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] sm:text-xs font-black uppercase bg-black text-white px-1.5 py-0.5 border border-black shrink-0">
                  #{job.requestId.slice(-6).toUpperCase()}
                </span>
                <span className="text-[10px] sm:text-xs font-black uppercase text-black font-mono shrink-0">
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
              isAcceptedAwaitingDeposit ? 'bg-[var(--color-brutal-yellow)] text-black animate-pulse' :
              currentStatus === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' :
              currentStatus === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' :
              currentStatus === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' :
              currentStatus === 'en_route' ? 'bg-[var(--color-brutal-teal)] text-black' :
              currentStatus === 'in_progress' ? 'bg-[#bbf7d0] text-black' :
              currentStatus === 'completed' ? 'bg-[var(--color-brutal-green)] text-black' :
              currentStatus === 'declined' ? 'bg-[var(--color-brutal-red)] text-white' :
              'bg-gray-800 text-white'
            }`}>
              {isAcceptedAwaitingDeposit 
                ? 'AWAITING DEPOSIT'
                : currentStatus === 'countered' 
                  ? (job.lastCounterBy === 'customer' ? 'WAITING PRO' : 'ACTION REQ') 
                  : currentStatus.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Timeline Progression Bar */}
        {!["cancelled", "declined"].includes(currentStatus) && (
          <div className="bg-white border-4 border-black p-6 mb-8 shadow-[6px_6px_0_0_#000]">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6">Booking Progress</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          {/* Main Booking Area (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">

            {/* ACTION BANNER */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-6 flex items-center justify-between">
                <span>Current Status & Actions</span>
                <span className="text-xs bg-black text-white px-2 py-1">Step {currentStepIndex + 1} of 5</span>
              </h2>

              {/* Status: Countered by Technician (Action Required by Customer) */}
              {currentStatus === "countered" && job.lastCounterBy === "artisan" && (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--color-brutal-yellow)] border-3 border-black">
                    <p className="font-black uppercase text-base">Technician Proposed Counter Offer</p>
                    <p className="text-2xl font-black text-black mt-1">₦{currentPrice.toLocaleString()}</p>
                    <p className="text-xs font-bold text-gray-800 mt-1 uppercase">
                      The technician proposed a new price for this job. You can accept, propose another counter, or decline.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleUpdateStatus("accepted")}
                      className="py-4 bg-[var(--color-brutal-green)] text-black font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                    >
                      ACCEPT (₦{currentPrice.toLocaleString()})
                    </button>
                    <button
                      onClick={() => setShowCounterModal(true)}
                      className="py-4 bg-[var(--color-brutal-yellow)] text-black font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                    >
                      COUNTER BACK
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("declined")}
                      className="py-4 bg-[var(--color-brutal-red)] text-white font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                    >
                      DECLINE
                    </button>
                  </div>
                </div>
              )}

              {/* Status: Countered by Customer (Waiting for Technician) */}
              {currentStatus === "countered" && job.lastCounterBy === "customer" && (
                <div className="p-6 bg-[var(--color-brutal-pink)] border-3 border-black text-center">
                  <p className="font-black uppercase text-lg mb-1">Your Counter Offer Sent</p>
                  <p className="text-sm font-bold text-gray-800">
                    Awaiting response from technician for proposed offer of ₦{currentPrice.toLocaleString()}.
                  </p>
                </div>
              )}

              {/* Status: Pending (Direct or Broadcast) */}
              {currentStatus === "pending" && (
                <div className="p-6 bg-[var(--color-brutal-yellow)] border-3 border-black">
                  <p className="font-black uppercase text-lg mb-1">Request Dispatched to Technician</p>
                  <p className="text-sm font-bold text-black leading-relaxed">
                    We have notified the technician. You will receive an immediate alert when they accept or send a counter offer.
                  </p>
                </div>
              )}

              {/* Status: Accepted & Awaiting Deposit */}
              {isAcceptedAwaitingDeposit && (
                <div className="p-6 bg-[var(--color-brutal-yellow)] border-4 border-black space-y-4 shadow-[4px_4px_0_0_#000]">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-black text-white text-xs font-black uppercase tracking-wider">ACTION REQUIRED</span>
                    <span className="text-xs font-black uppercase text-black font-mono">25% COMMITMENT ESCROW</span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-black">
                      TECHNICIAN ACCEPTED! PAY DEPOSIT TO CONFIRM
                    </h3>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      A technician has accepted your request. To confirm this booking and dispatch the technician, please pay the 25% commitment deposit into escrow.
                    </p>
                  </div>

                  <div className="p-4 bg-white border-3 border-black flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="text-xs font-black uppercase text-gray-500">Deposit Due Now (25%)</p>
                      <p className="text-3xl font-black text-black">₦{Math.round(currentPrice * 0.25).toLocaleString()}</p>
                      <p className="text-xs font-bold text-gray-600 mt-0.5">Remaining ₦{Math.round(currentPrice * 0.75).toLocaleString()} payable upon job completion</p>
                    </div>

                    <button
                      onClick={handlePayDeposit}
                      disabled={payingDeposit}
                      className="w-full sm:w-auto px-6 py-4 bg-[var(--color-brutal-green)] text-black font-black uppercase tracking-widest border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 text-sm md:text-base cursor-pointer"
                    >
                      {payingDeposit ? "REDIRECTING TO PAYSTACK..." : `PAY DEPOSIT (₦${Math.round(currentPrice * 0.25).toLocaleString()})`}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-black uppercase text-black pt-1">
                    <ShieldCheck className="w-4 h-4 text-green-700 shrink-0" />
                    <span>Held securely in escrow by NEED until you inspect and approve the completed job.</span>
                  </div>
                </div>
              )}

              {/* Status: Accepted (Deposit Paid / Confirmed) / En Route */}
              {["accepted", "en_route"].includes(currentStatus) && !isAcceptedAwaitingDeposit && (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--color-brutal-teal)] border-3 border-black">
                    <p className="font-black uppercase text-base">Technician Confirmed Booking!</p>
                    <p className="text-xs font-bold text-black mt-1">
                      {currentStatus === "en_route" 
                        ? "The technician is currently on their way to your address." 
                        : "The technician has accepted and is preparing to travel."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link
                      href={`/jobs/${job.requestId}/track`}
                      className="py-4 bg-black text-white font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-[var(--color-brutal-yellow)] hover:text-black transition-all flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-5 h-5" />
                      <span>TRACK LIVE GPS</span>
                    </Link>

                    <Link
                      href={`/chat/${job.requestId}`}
                      className="py-4 bg-white text-black font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>CHAT WITH TECHNICIAN</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Status: In Progress */}
              {currentStatus === "in_progress" && (
                <div className="space-y-4">
                  <div className="p-5 bg-[#bbf7d0] border-3 border-black">
                    <p className="font-black uppercase text-base">Work in Progress</p>
                    <p className="text-xs font-bold text-black mt-1">
                      The technician is currently working on site. If you require emergency assistance, use the panic button below.
                    </p>
                  </div>

                  <Link
                    href={`/chat/${job.requestId}`}
                    className="w-full py-4 bg-[var(--color-brutal-teal)] text-black font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2 block"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span>OPEN CHAT WITH TECHNICIAN</span>
                  </Link>
                </div>
              )}

              {/* Status: Completed */}
              {currentStatus === "completed" && (
                <div className="space-y-4">
                  <div className="p-6 sm:p-8 bg-[var(--color-brutal-green)] border-4 border-black text-center shadow-[4px_4px_0_0_#000]">
                    <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white border-4 border-black shadow-[4px_4px_0_0_#000] -rotate-2 mx-auto mb-4 p-2">
                      <BrutalCelebrationIcon className="w-12 h-12 sm:w-14 sm:h-14" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black mb-1.5">
                      Job Successfully Completed!
                    </h3>
                    <p className="text-xs sm:text-sm font-black text-black uppercase max-w-md mx-auto">
                      Thank you for using NEED. Your payment is settled and this job is protected by our 30-Day Workmanship Guarantee.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {!job.reviewed && !reviewingJob && (
                      <button
                        onClick={() => setReviewingJob(true)}
                        className="py-3.5 bg-[var(--color-brutal-yellow)] text-black font-black uppercase tracking-widest text-xs border-3 border-black shadow-[3px_3px_0_0_#000] hover:bg-black hover:text-white transition-all flex items-center justify-center gap-1.5"
                      >
                        <Star className="w-4 h-4 fill-current" />
                        <span>LEAVE REVIEW</span>
                      </button>
                    )}

                    <Link
                      href={`/artisan/${job.artisanId}/request?trade=${encodeURIComponent(job.trade)}&subcategory=${encodeURIComponent(job.subcategory)}`}
                      className="py-3.5 bg-white text-black font-black uppercase tracking-widest text-xs border-3 border-black shadow-[3px_3px_0_0_#000] hover:bg-black hover:text-white transition-all flex items-center justify-center gap-1.5 text-center"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>BOOK AGAIN</span>
                    </Link>

                    <Link
                      href={`/jobs/${job.requestId}/receipt`}
                      className="py-3.5 bg-black text-white font-black uppercase tracking-widest text-xs border-3 border-black shadow-[3px_3px_0_0_#000] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-1.5 text-center"
                    >
                      <FileText className="w-4 h-4" />
                      <span>VIEW RECEIPT</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 30-DAY WORKMANSHIP GUARANTEE BANNER (When Completed) */}
            {currentStatus === "completed" && (
              <div className="bg-purple-50 border-4 border-black p-6 shadow-[6px_6px_0_0_#000] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-600 border-3 border-black flex items-center justify-center text-white shrink-0">
                      <Award className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-black text-base uppercase text-purple-950">
                        Protected by NEED 30-Day Workmanship Guarantee
                      </h3>
                      <p className="text-xs font-bold text-purple-800">
                        If defects or issues arise with this completed job within 30 days, we arrange a free rework or credit refund.
                      </p>
                    </div>
                  </div>

                  {job.guaranteeClaimId ? (
                    <span className="px-3 py-1.5 bg-yellow-400 text-black border-2 border-black font-black text-xs uppercase self-start">
                      {job.guaranteeResolution === "redo_arranged"
                        ? "Free Redo Arranged"
                        : job.guaranteeResolution === "refunded_clawback"
                        ? "Refund Issued"
                        : job.guaranteeResolution === "rejected"
                        ? "Claim Closed"
                        : "Claim Under Review"}
                    </span>
                  ) : (
                    <button
                      onClick={() => setClaimingGuarantee(true)}
                      className="px-5 py-3 bg-purple-700 text-white border-3 border-black font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:bg-black hover:text-white transition-all self-start whitespace-nowrap"
                    >
                      CLAIM GUARANTEE
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* REVIEW FORM INLINE */}
            {reviewingJob && (
              <form onSubmit={handleSubmitReview} className="bg-[var(--color-brutal-blue)] p-6 border-4 border-black shadow-[6px_6px_0_0_#000] space-y-4">
                <h3 className="text-2xl font-black uppercase text-black">Review Technician</h3>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1 text-black">Rating (1-5 Stars)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`w-12 h-12 border-3 border-black font-black text-xl flex items-center justify-center transition-all ${
                          rating >= star ? 'bg-[var(--color-brutal-yellow)] scale-105' : 'bg-white'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1 text-black">Your Review</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Describe your experience with the technician..."
                    rows={3}
                    className="w-full p-3 border-3 border-black font-bold text-sm bg-white focus:outline-none"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex-1 py-3.5 bg-black text-white border-3 border-black font-black uppercase tracking-widest text-sm hover:bg-white hover:text-black transition-colors"
                  >
                    {submittingReview ? "SUBMITTING..." : "SUBMIT REVIEW"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewingJob(false)}
                    className="py-3.5 px-6 bg-white text-black border-3 border-black font-black uppercase tracking-widest text-sm"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}

            {/* JOB SCOPE CARD */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-6">
                Booking Details & Requirements
              </h2>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Service Type</p>
                  <p className="font-black text-2xl uppercase text-black">{job.trade} • {job.subcategory}</p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Your Job Description</p>
                  <div className="p-4 bg-[var(--color-brutal-bg)] border-3 border-black">
                    <p className="font-bold text-black text-base whitespace-pre-wrap">{job.description || "No specific description added."}</p>
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

                  <div className="p-4 bg-gray-50 border-3 border-black flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-[var(--color-brutal-pink)]" /> Service Address
                      </p>
                      <p className="font-black text-lg text-black uppercase">{job.neighborhood || "Location on record"}</p>
                      {job.locationCoords?.lat && job.locationCoords?.lng && (job.locationCoords.lat !== 0 || job.locationCoords.lng !== 0) ? (
                        <p className="text-[11px] font-black uppercase bg-[var(--color-brutal-green)] text-black px-2 py-0.5 border-2 border-black inline-block mt-1">
                          GPS: {job.locationCoords.lat.toFixed(5)}, {job.locationCoords.lng.toFixed(5)}
                        </p>
                      ) : null}
                    </div>
                    {["pending", "accepted", "en_route", "countered", "payment_pending"].includes(currentStatus) && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocationInput(job.neighborhood || "");
                          setDetectedCoords(job.locationCoords || null);
                          setLocationError("");
                          setShowLocationModal(true);
                        }}
                        className="mt-3 text-xs bg-[var(--color-brutal-yellow)] text-black font-black uppercase px-3 py-2 border-2 border-black shadow-[2px_2px_0_0_#000] hover:bg-black hover:text-white transition-all flex items-center justify-center gap-1.5 w-full"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>UPDATE LOCATION</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RESCHEDULE NOTICE OR BUTTON */}
            {["accepted", "en_route"].includes(currentStatus) && (
              <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
                <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-black pb-3 mb-4 flex items-center justify-between">
                  <span>Schedule & Rescheduling</span>
                  <Calendar className="w-5 h-5" />
                </h2>

                {job.rescheduleStatus === "pending" ? (
                  job.rescheduleRequestedBy === "artisan" ? (
                    <div className="bg-[var(--color-brutal-yellow)] p-4 border-3 border-black">
                      <p className="font-black text-black uppercase mb-2">
                        Technician requested to reschedule to: <br />
                        <span className="text-lg underline">{formatDateTime12Hour(job.newPreferredTime)}</span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespondReschedule("accepted", job.newPreferredTime!)}
                          className="flex-1 bg-[var(--color-brutal-green)] text-black border-2 border-black font-black uppercase py-2 shadow-[2px_2px_0_0_#000]"
                        >
                          Accept New Time
                        </button>
                        <button
                          onClick={() => handleRespondReschedule("declined", "")}
                          className="flex-1 bg-[var(--color-brutal-red)] text-white border-2 border-black font-black uppercase py-2 shadow-[2px_2px_0_0_#000]"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-100 border-3 border-black text-center font-bold text-sm uppercase">
                      Waiting for technician to accept your reschedule request.
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => setReschedulingJob(true)}
                    className="w-full py-3 bg-[var(--color-brutal-yellow)] border-3 border-black font-black uppercase tracking-widest text-sm hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]"
                  >
                    REQUEST A RESCHEDULE
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar (Right Column) */}
          <div className="space-y-6">

            {/* PRICING & PAYMENT SUMMARY */}
            <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
              <p className="text-xs font-black uppercase tracking-widest text-black mb-1">Total Agreed Amount</p>
              <h2 className="text-4xl md:text-5xl font-black text-black tracking-tighter">₦{currentPrice.toLocaleString()}</h2>

              {isAcceptedAwaitingDeposit ? (
                <div className="mt-4 p-4 bg-white border-3 border-black space-y-2">
                  <div className="flex justify-between items-center text-xs font-black uppercase">
                    <span>25% Escrow Deposit:</span>
                    <span className="text-base text-red-600">₦{Math.round(currentPrice * 0.25).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-gray-600 uppercase">
                    <span>Remaining Balance:</span>
                    <span>₦{Math.round(currentPrice * 0.75).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={handlePayDeposit}
                    disabled={payingDeposit}
                    className="w-full mt-2 py-3 bg-[var(--color-brutal-green)] text-black font-black uppercase tracking-wider text-xs border-2 border-black shadow-[2px_2px_0_0_#000] hover:bg-black hover:text-white transition-all cursor-pointer"
                  >
                    {payingDeposit ? "PROCESSING..." : "PAY DEPOSIT NOW"}
                  </button>
                </div>
              ) : job.depositPaid && job.depositPaid > 0 ? (
                <div className="mt-4 p-3 bg-white border-2 border-black space-y-1">
                  <p className="text-xs font-black uppercase text-green-700 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Deposit Paid: ₦{Math.round(job.depositPaid / 100).toLocaleString()}
                  </p>
                  <p className="text-xs font-bold text-gray-700 uppercase">
                    Balance due upon completion: ₦{(currentPrice - Math.round(job.depositPaid / 100)).toLocaleString()}
                  </p>
                </div>
              ) : null}

              <div className="mt-6 border-t-3 border-black pt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-black">
                  <ShieldCheck className="w-4 h-4 text-green-700 shrink-0" />
                  <span>Escrow & Safety Guaranteed</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-black uppercase text-black">
                  <Award className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>30-Day Workmanship Warranty</span>
                </div>
              </div>
            </div>

            {/* ASSIGNED TECHNICIAN CARD */}
            {job.artisanId && (
              <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 border-b-2 border-black pb-2">
                  Assigned Technician
                </h3>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full border-3 border-black overflow-hidden bg-[var(--color-brutal-teal)] shrink-0">
                    <UserAvatar 
                      photoURL={artisan?.profilePictureUrl || artisanUser?.photoURL} 
                      name={artisan?.name || artisanUser?.displayName || "Technician"} 
                      className="w-full h-full text-xl font-black" 
                    />
                  </div>
                  <div>
                    <p className="font-black text-xl text-black uppercase leading-tight">
                      {artisan?.name || artisanUser?.displayName || (artisanUser?.firstName ? `${artisanUser.firstName} ${artisanUser.lastName || ''}` : "Technician")}
                    </p>
                    <p className="text-xs font-black uppercase text-gray-600 mt-0.5">{artisan?.trade || job.trade}</p>
                    <div className="flex items-center gap-1 text-xs font-black uppercase mt-1">
                      <Star className="w-3.5 h-3.5 fill-[var(--color-brutal-yellow)] stroke-black" />
                      <span>{artisan?.ratingAverage ? artisan.ratingAverage.toFixed(1) : "5.0"} ({artisan?.ratingCount || 0} reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link
                    href={`/artisan/${job.artisanId}`}
                    className="w-full py-2.5 bg-gray-100 text-black font-black uppercase tracking-widest text-xs text-center border-2 border-black hover:bg-[var(--color-brutal-yellow)] transition-colors flex items-center justify-center gap-1.5 block"
                  >
                    <span>VIEW PUBLIC PROFILE</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href={`/chat/${job.requestId}`}
                    className="w-full py-4 bg-[var(--color-brutal-teal)] text-black font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-2 block"
                  >
                    <MessageSquare className="w-5 h-5 stroke-[2.5]" />
                    <span>CHAT WITH TECHNICIAN</span>
                  </Link>

                  {["accepted", "en_route", "in_progress"].includes(currentStatus) && (
                    <button
                      type="button"
                      onClick={() => handleStartCall("audio")}
                      disabled={callingInProgress}
                      className="w-full py-3.5 bg-white text-black font-black uppercase tracking-widest text-center border-4 border-black shadow-[4px_4px_0_0_#000] hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <PhoneCall className="w-5 h-5 stroke-[2.5]" />
                      <span>{callingInProgress ? "CONNECTING..." : "IN-APP VOICE CALL"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

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
                  onClick={() => setCancellingJob(true)}
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
                Send Counter Offer
              </h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const amt = parseInt(counterInput.replace(/,/g, ''), 10);
                if (amt > 0) handleUpdateStatus("countered", amt);
              }} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1">
                    Your Proposed Price (₦)
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="1000"
                    placeholder="e.g. 10000"
                    value={counterInput}
                    onChange={e => setCounterInput(e.target.value)}
                    required
                    className="w-full p-4 border-4 border-black font-black text-3xl focus:outline-none focus:bg-[var(--color-brutal-yellow)] transition-colors"
                  />
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
                    disabled={!counterInput}
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

      {/* CANCEL BOOKING MODAL */}
      {cancellingJob && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border-4 border-black max-w-md w-full shadow-[8px_8px_0_0_var(--color-brutal-red)] relative">
            <button 
              onClick={() => setCancellingJob(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] transition-colors"
            >
              <X className="w-8 h-8 stroke-[3]" />
            </button>
            
            <div className="p-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 border-b-4 border-black pb-2 text-red-600">
                Cancel Booking
              </h2>
              
              <p className="text-xs font-bold text-gray-700 mb-4 uppercase">
                Please complete this cancellation survey so we understand what happened and can assist you.
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
                  {CUSTOMER_CANCEL_CATEGORIES.map(cat => (
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
                  placeholder="Please describe why you are cancelling this booking..."
                  className="w-full p-3 border-4 border-black font-bold text-sm min-h-[100px] focus:outline-none shadow-[2px_2px_0_0_#000]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCancellingJob(false);
                    setCancelCategory("");
                    setCancelReason("");
                  }}
                  className="flex-1 py-3 bg-white border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000] hover:bg-gray-100"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const catObj = CUSTOMER_CANCEL_CATEGORIES.find(c => c.value === cancelCategory);
                    const catLabel = catObj?.label || "Other";
                    const combinedReason = `[${catLabel}] ${cancelReason.trim()}`;
                    handleUpdateStatus("cancelled", null, combinedReason, cancelCategory);
                  }}
                  disabled={!cancelCategory || !cancelReason.trim()}
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
      {reschedulingJob && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white border-4 border-black max-w-md w-full shadow-[8px_8px_0_0_var(--color-brutal-yellow)] relative">
            <button 
              onClick={() => setReschedulingJob(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] transition-colors"
            >
              <X className="w-8 h-8 stroke-[3]" />
            </button>
            
            <div className="p-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-2">
                Propose New Time
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1">New Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full p-3 border-3 border-black font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-1">New Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="w-full p-3 border-3 border-black font-bold"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReschedulingJob(false)}
                    className="flex-1 py-3 bg-white border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestReschedule}
                    disabled={!newDate || !newTime}
                    className="flex-1 py-3 bg-[var(--color-brutal-green)] text-black border-3 border-black font-black uppercase text-sm shadow-[2px_2px_0_0_#000] hover:bg-black hover:text-white transition-all disabled:opacity-50"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GUARANTEE CLAIM MODAL */}
      {claimingGuarantee && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6 max-w-lg w-full space-y-4">
            <div className="border-b-2 border-black pb-2 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" />
                Claim 30-Day Workmanship Guarantee
              </h3>
              <button
                onClick={() => setClaimingGuarantee(false)}
                disabled={submittingGuarantee}
                className="font-black text-sm px-2 py-1 border-2 border-black hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-purple-50 border-2 border-black p-3 text-xs text-purple-950 font-bold">
              NEED guarantees quality workmanship for all on-platform jobs. If the work is defective, our team will order a free redo from the technician or issue a platform credit refund.
            </div>

            <form onSubmit={handleSubmitGuaranteeClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Describe the Issue (Defects, Faults, Incomplete Work):
                </label>
                <textarea
                  value={guaranteeDescription}
                  onChange={(e) => setGuaranteeDescription(e.target.value)}
                  placeholder="Explain what went wrong with the completed service..."
                  rows={4}
                  required
                  className="w-full p-3 border-2 border-black text-sm font-bold bg-white focus:outline-none focus:bg-yellow-100"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Evidence Photo URL (Optional):
                </label>
                <input
                  type="url"
                  value={guaranteePhotoUrl}
                  onChange={(e) => setGuaranteePhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 border-2 border-black text-sm font-bold bg-white focus:outline-none focus:bg-yellow-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submittingGuarantee}
                  className="flex-1 bg-black text-white py-3 font-black uppercase text-xs border-2 border-black hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  {submittingGuarantee ? "Submitting Claim..." : "Submit Guarantee Claim"}
                </button>
                <button
                  type="button"
                  onClick={() => setClaimingGuarantee(false)}
                  disabled={submittingGuarantee}
                  className="flex-1 bg-white text-black py-3 font-black uppercase text-xs border-2 border-black hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOCATION UPDATE MODAL */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0_0_#000]">
            <div className="flex justify-between items-center border-b-4 border-black pb-3 mb-4">
              <h3 className="font-black text-xl uppercase tracking-tight flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[var(--color-brutal-pink)]" />
                <span>Update Service Location</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="p-1 hover:bg-gray-100 border-2 border-transparent hover:border-black transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-gray-600 uppercase mb-4">
              Update your exact location so your technician can navigate precisely to your doorstep.
            </p>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              {/* GPS DETECTION BUTTON */}
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isLocating}
                className="w-full py-3.5 bg-[var(--color-brutal-teal)] text-black font-black uppercase tracking-wider text-sm border-3 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-2"
              >
                <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? "DETECTING GPS COORDS..." : "USE CURRENT GPS LOCATION"}</span>
              </button>

              {detectedCoords && (
                <div className="p-3 bg-[var(--color-brutal-green)] border-2 border-black">
                  <p className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    Exact GPS Pin Locked: {detectedCoords.lat.toFixed(6)}, {detectedCoords.lng.toFixed(6)}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Neighborhood / Street Address
                </label>
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="e.g. 5th Avenue, Gwarinpa, Abuja"
                  className="w-full p-3 border-3 border-black font-bold text-sm bg-white focus:outline-none focus:bg-yellow-50"
                />
              </div>

              {locationError && (
                <div className="p-3 bg-[var(--color-brutal-red)] text-white border-2 border-black font-bold text-xs uppercase flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingLocation || isLocating}
                  className="flex-1 bg-black text-white py-3.5 font-black uppercase text-xs border-3 border-black shadow-[3px_3px_0_0_#000] hover:bg-[var(--color-brutal-yellow)] hover:text-black transition-all disabled:opacity-50"
                >
                  {savingLocation ? "SAVING..." : "SAVE LOCATION"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  disabled={savingLocation}
                  className="px-5 bg-white text-black py-3.5 font-black uppercase text-xs border-3 border-black hover:bg-gray-100 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {reportingJob && auth.currentUser && (
        <ReportModal 
          jobId={job.requestId}
          reportedUserId={job.artisanId!}
          reporterUserId={auth.currentUser.uid}
          reporterRole="customer"
          onClose={() => setReportingJob(false)}
        />
      )}
    </div>
  );
}
