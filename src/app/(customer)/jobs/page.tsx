"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, runTransaction, onSnapshot } from "firebase/firestore";
import { JobRequest, ArtisanProfile } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";
import AuthGate from "@/components/AuthGate";
import Link from "next/link";
import ReportModal from "@/components/ReportModal";
import { AlertTriangle, Wrench, MapPin, Clock, MessageSquare, Calendar, X, Star, CheckCircle, RefreshCw, FileText, PhoneCall, CreditCard, Camera } from "lucide-react";
import { formatDateTime12Hour, to12HourFormat } from "@/utils/formatTime";

export default function CustomerJobsPage() {
  return (
    <AuthGate title="Sign in to view bookings" description="Create a free account to track and manage your bookings.">
      <JobsContent />
    </AuthGate>
  );
}

function JobsContent() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingJob, setReviewingJob] = useState<string | null>(null);
  const [reportingJob, setReportingJob] = useState<JobRequest | null>(null);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounterFor, setShowCounterFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { showAlert } = useAlert();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribe) {
        unsubscribe();
      }

      if (!user) {
        setLoading(false);
        return;
      }

      const q = query(collection(db, "jobRequests"), where("customerId", "==", user.uid));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(doc => doc.data() as JobRequest);
        results.sort((a, b) => b.createdAt - a.createdAt);

        setRequests((prev) => {
          const prevKey = JSON.stringify(prev.map(r => ({ id: r.requestId, s: r.status, lat: r.technicianLocation?.lat, lng: r.technicianLocation?.lng })));
          const nextKey = JSON.stringify(results.map(r => ({ id: r.requestId, s: r.status, lat: r.technicianLocation?.lat, lng: r.technicianLocation?.lng })));
          if (prevKey === nextKey) return prev;
          return results;
        });
        setLoading(false);
      }, (error) => {
        console.error("Error fetching requests:", error);
        setLoading(false);
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
      unsubscribeAuth();
    };
  }, []);


  const handleUpdateStatus = async (requestId: string, newStatus: JobRequest['status'], counterAmt: number | null = null) => {
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      
      const updatePayload: Partial<JobRequest> = { 
        status: newStatus 
      };

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
      }

      await updateDoc(reqRef, updatePayload);
      
      setRequests(prev => prev.map(req => 
        req.requestId === requestId ? { ...req, ...updatePayload } : req
      ));
      
      if (newStatus === "countered") {
        showAlert("Counter offer sent!", "success");
        setShowCounterFor(null);
      }
    } catch (error) {
      console.error("Failed to update status", error);
      showAlert("Error updating status", "error");
    }
  };

  const handleSOS = async (requestId: string) => {
    if (confirm("Are you in immediate danger? This will alert our safety team and the authorities.")) {
      try {
        const reqRef = doc(db, "jobRequests", requestId);
        await updateDoc(reqRef, {
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
        newPreferredTime: `${newDate} at ${to12HourFormat(newTime)}`,
        rescheduleRequestedBy: "customer",
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

  const handleSubmitReview = async (e: React.FormEvent, req: JobRequest) => {
    e.preventDefault();
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get Artisan Profile
        const artisanRef = doc(db, "artisans", req.artisanId as string);
        const artisanDoc = await transaction.get(artisanRef);
        
        if (!artisanDoc.exists()) {
          throw new Error("Artisan does not exist!");
        }

        const artisanData = artisanDoc.data() as ArtisanProfile;
        const currentCount = artisanData.ratingCount || 0;
        const currentAvg = artisanData.ratingAverage || 0;

        // Calculate new average
        const newCount = currentCount + 1;
        const newAvg = ((currentAvg * currentCount) + rating) / newCount;

        // 2. Create the Review document
        const reviewRef = doc(collection(db, "reviews"));
        transaction.set(reviewRef, {
          reviewId: reviewRef.id,
          requestId: req.requestId,
          artisanId: req.artisanId,
          customerId: req.customerId,
          rating,
          comment,
          createdAt: Date.now()
        });

        // 3. Update the Artisan Profile
        transaction.update(artisanRef, {
          ratingCount: newCount,
          ratingAverage: newAvg
        });

        // 4. Mark job as reviewed
        const reqRef = doc(db, "jobRequests", req.requestId);
        transaction.update(reqRef, {
          reviewed: true
        });
      });

      // Update local state
      setRequests(prev => prev.map(r => 
        r.requestId === req.requestId ? { ...r, reviewed: true } : r
      ));

      showAlert("Review submitted successfully!", "success");
      setReviewingJob(null);
    } catch (err) {
      console.error(err);
      showAlert("Failed to submit review", "error");
    }
  };

  return (
    <div className="w-full pt-16 px-6 md:px-12 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] mt-4">
        MY BOOKINGS
      </h1>
      
      {loading ? (
        <GlobalSpinner text="LOADING YOUR REQUESTS" />
      ) : requests.length === 0 ? (
        <div className="bg-[var(--color-brutal-yellow)] brutal-border p-12 text-center shadow-[8px_8px_0_0_#000] rotate-1 max-w-2xl mx-auto my-12">
          <div className="w-24 h-24 bg-white border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_#000] -rotate-6">
            <Wrench className="w-12 h-12 stroke-[3] mx-auto" />
          </div>
          <h2 className="text-3xl font-black text-black uppercase tracking-tighter mb-4">No Bookings Yet!</h2>
          <p className="text-black font-bold text-lg bg-white border-2 border-black inline-block px-4 py-2 -rotate-1">
            When you request a job, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {requests.map((req) => {
            const currentStatus = String(req.status || req.state || 'pending');
            const currentPrice = currentStatus === "countered" && req.counterOfferAmount 
              ? req.counterOfferAmount 
              : (req.offerAmount || (req.agreedPrice ? Math.round(req.agreedPrice / 100) : 0));

            const isAcceptedAwaitingDeposit = (req.status === "accepted" || currentStatus === "accepted") && 
              (req.state === "awaiting_deposit" || req.depositStatus === "pending" || (!req.depositPaid && req.depositStatus !== "held"));
            const isJustAwaitingDeposit = !isAcceptedAwaitingDeposit && (req.state === "awaiting_deposit" || req.depositStatus === "pending");

            return (
              <div key={req.requestId} className="bg-white brutal-border brutal-shadow-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col h-full">
                <div className="p-6 md:p-8 flex flex-col flex-grow">
                  <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-6 border-b-4 border-black pb-6 flex-grow">
                    <div>
                      <span className={`inline-block px-4 py-2 text-xs font-black uppercase tracking-widest mb-3 brutal-border
                        ${isAcceptedAwaitingDeposit ? 'bg-[var(--color-brutal-yellow)] text-black border-4 border-black animate-pulse' : ''}
                        ${!isAcceptedAwaitingDeposit && isJustAwaitingDeposit ? 'bg-yellow-100 text-black border-2 border-black' : ''}
                        ${!isAcceptedAwaitingDeposit && !isJustAwaitingDeposit && currentStatus === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                        ${!isAcceptedAwaitingDeposit && currentStatus === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                        ${!isAcceptedAwaitingDeposit && currentStatus === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' : ''}
                        ${currentStatus === 'en_route' ? 'bg-[var(--color-brutal-teal)] text-black' : ''}
                        ${currentStatus === 'in_progress' ? 'bg-[#bbf7d0] text-black' : ''}
                        ${currentStatus === 'completed' ? 'bg-[var(--color-brutal-teal)] text-black border-dashed' : ''}
                        ${currentStatus === 'declined' ? 'bg-[var(--color-brutal-red)] text-white' : ''}
                        ${currentStatus === 'cancelled' ? 'bg-gray-800 text-white' : ''}
                      `}>
                        {isAcceptedAwaitingDeposit 
                          ? 'JOB ACCEPTED • AWAITING DEPOSIT'
                          : isJustAwaitingDeposit
                            ? 'AWAITING DEPOSIT'
                            : currentStatus === 'countered' 
                              ? (req.lastCounterBy === 'customer' ? 'AWAITING TECHNICIAN' : 'ACTION REQUIRED') 
                              : currentStatus === 'declined' 
                                ? (req.declinedBy === 'customer' ? 'CUSTOMER DECLINED' : 'TECHNICIAN DECLINED') 
                                : currentStatus.replace('_', ' ')}
                      </span>
                      <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">
                        {req.trade} - {req.subcategory}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 uppercase tracking-widest mt-2">
                        <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1 flex items-center gap-1 text-xs font-bold text-black">
                          <Clock className="w-3 h-3" /> {formatDateTime12Hour(req.preferredTime) || "Flexible"}
                        </span>
                        {req.neighborhood && (
                          <span className="bg-white border-2 border-black px-2 py-1 flex items-center gap-1 text-xs font-bold text-black">
                            <MapPin className="w-3 h-3 text-[var(--color-brutal-pink)]" /> {req.neighborhood}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-[var(--color-brutal-bg)] brutal-border p-4 text-right min-w-[200px] shadow-[4px_4px_0_0_#000]">
                      <p className="text-xs text-black font-black uppercase tracking-widest mb-1 bg-white inline-block px-1 border-2 border-black -rotate-2">
                        {currentStatus === "countered" 
                          ? (req.lastCounterBy === 'customer' ? "Your Counter" : "Technician's Counter")
                          : "Your Offer"}
                      </p>
                      <p className="text-4xl font-black text-black tracking-tighter mt-1">₦{currentPrice.toLocaleString()}</p>
                    </div>
                  </div>

                  {req.description && (
                    <div className="bg-[var(--color-brutal-bg)] border-2 border-black p-3 mb-4">
                      <p className="text-xs font-black uppercase tracking-wider text-gray-600 mb-0.5">Job Requirements</p>
                      <p className="text-sm font-bold text-black line-clamp-3 whitespace-pre-wrap">{req.description}</p>
                    </div>
                  )}

                  {req.mediaUrl && (
                    <div className="mb-4">
                      <a 
                        href={req.mediaUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 bg-white border-2 border-black px-3 py-1.5 text-xs font-black uppercase hover:bg-[var(--color-brutal-yellow)] transition-colors shadow-[2px_2px_0_0_#000]"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>View Attached {req.mediaUrl.match(/\.(mp4|webm|mov|ogg)/i) ? "Video" : "Photo"}</span>
                      </a>
                    </div>
                  )}

                  {currentStatus === "cancelled" && req.cancelledReason && (
                    <div className="bg-red-100 p-5 brutal-border mb-6 shadow-[2px_2px_0_0_#000] border-red-500">
                      <p className="font-black text-red-900 flex items-center gap-2 mb-1 uppercase tracking-widest"><AlertTriangle className="w-5 h-5" /> Job Cancelled</p>
                      <p className="font-bold text-red-800">{req.cancelledReason}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-3">
                    {isAcceptedAwaitingDeposit && (
                      <Link 
                        href={`/jobs/${req.requestId}`} 
                        className="w-full bg-[var(--color-brutal-green)] border-4 border-black font-black uppercase text-center block py-4 hover:bg-black hover:text-white transition-colors brutal-shadow-sm"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <CreditCard className="w-5 h-5 stroke-[2.5]" />
                          <span>PAY DEPOSIT & FINALIZE BOOKING</span>
                        </span>
                      </Link>
                    )}

                    {["accepted", "confirmed", "en_route", "in_progress", "payment_pending", "completed"].includes(currentStatus) && (
                      <Link href={`/chat/${req.requestId}`} className="w-full bg-white border-4 border-black font-black uppercase text-center block py-3.5 hover:bg-[var(--color-brutal-bg)] transition-colors brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                        <span className="flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> CHAT WITH TECHNICIAN</span>
                      </Link>
                    )}

                    <Link href={`/jobs/${req.requestId}`} className="w-full bg-[var(--color-brutal-yellow)] border-4 border-black font-black uppercase text-center block py-3.5 hover:bg-black hover:text-white transition-colors brutal-shadow-sm">
                      <span className="flex items-center justify-center gap-2"><Wrench className="w-5 h-5" /> MANAGE BOOKING</span>
                    </Link>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {reportingJob && auth.currentUser && (
        <ReportModal 
          jobId={reportingJob.requestId}
          reportedUserId={reportingJob.artisanId!}
          reporterUserId={auth.currentUser.uid}
          reporterRole="customer"
          onClose={() => setReportingJob(null)}
        />
      )}
    </div>
  );
}
