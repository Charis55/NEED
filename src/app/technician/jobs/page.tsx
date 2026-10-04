"use client";

import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import PayCommissionModal from "@/components/PayCommissionModal";
import Link from "next/link";
import ReportModal from "@/components/ReportModal";
import { AlertTriangle, Mailbox, MapPin, Clock, Map as MapIcon, MessageSquare, Calendar, X, PhoneCall } from "lucide-react";
import { useAlert } from "@/components/AlertProvider";
import { Capacitor } from "@capacitor/core";

export default function ArtisanDashboard() {
  const { showAlert } = useAlert();
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [reportingJob, setReportingJob] = useState<JobRequest | null>(null);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounterFor, setShowCounterFor] = useState<string | null>(null);
  const [promoDaysLeft, setPromoDaysLeft] = useState<number | null>(null);
  const [showPromoOverlay, setShowPromoOverlay] = useState(false);

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubs.forEach(unsub => unsub());
      unsubs = [];

      if (!user) {
        setLoading(false);
        return;
      }

      let validServices: { trade: string, subcategory: string }[] = [];
      let isVerifiedArtisan = false;
      let directResults: JobRequest[] = [];
      let broadcastResults: JobRequest[] = [];

      const updateCombined = () => {
        const matchedBroadcastResults = isVerifiedArtisan
          ? broadcastResults.filter(job => validServices.some(svc => svc.trade === job.trade && svc.subcategory === job.subcategory))
          : [];

        const combined = [...directResults, ...matchedBroadcastResults];
        const uniqueResults = Array.from(new Map(combined.map(item => [item.requestId, item])).values());
        uniqueResults.sort((a, b) => b.createdAt - a.createdAt);

        setRequests((prev) => {
          const prevKey = JSON.stringify(prev.map(r => ({ id: r.requestId, s: r.status, lat: r.technicianLocation?.lat, lng: r.technicianLocation?.lng })));
          const nextKey = JSON.stringify(uniqueResults.map(r => ({ id: r.requestId, s: r.status, lat: r.technicianLocation?.lat, lng: r.technicianLocation?.lng })));
          if (prevKey === nextKey) return prev;
          return uniqueResults;
        });
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

  const handleUpdateStatus = async (requestId: string, newStatus: JobRequest['status'], counterAmt: number | null = null) => {
    if ((newStatus === 'accepted' || newStatus === 'countered') && !isVerified) {
      showAlert("Your account must be approved by an administrator before you can accept or counter jobs.", "error");
      return;
    }
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      
      const updatePayload: Partial<JobRequest> = { 
        status: newStatus 
      };

      const user = auth.currentUser;
      const req = requests.find(r => r.requestId === requestId);
      if (req?.isBroadcast && user) {
        updatePayload.artisanId = user.uid;
      }

      if (newStatus === "completed" || newStatus === "payment_pending") {
        updatePayload.completedAt = Date.now();
      }

      if (newStatus === "countered" && counterAmt) {
        const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
        const platformFeeRate = isPromoActive ? 0 : 0.20;
        updatePayload.counterOfferAmount = counterAmt;
        updatePayload.platformFee = counterAmt * platformFeeRate;
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
        } else if (newStatus === "in_progress") {
          title = "Technician Arrived!"; body = "Your technician has arrived and started the job.";
        } else if (newStatus === "completed" || newStatus === "payment_pending") {
          title = "Job Completed!"; body = "The job has been marked as completed.";
        }
        
        if (["accepted", "en_route", "in_progress", "completed", "payment_pending"].includes(newStatus)) {
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

      setRequests(prev => prev.map(req => {
        if (req.requestId === requestId) {
          const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
          const platformFeeRate = isPromoActive ? 0 : 0.20;
          return { 
            ...req, 
            status: newStatus, 
            ...(newStatus === "countered" ? { counterOfferAmount: counterAmt, platformFee: counterAmt! * platformFeeRate, lastCounterBy: "artisan" } : {}) 
          };
        }
        return req;
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
          <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-[var(--color-brutal-yellow)] inline-block pr-3 -rotate-1 shadow-[2px_2px_0_0_#000]">Manage incoming and active jobs.</p>
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
              const currentPrice = req.counterOfferAmount || req.offerAmount || 0;
              
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
                    <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-6 border-b-4 border-black pb-6 flex-grow">
                      <div>
                        <span className={`inline-block px-4 py-2 text-xs font-black uppercase tracking-widest mb-3 brutal-border
                          ${req.status === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                          ${req.status === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                          ${req.status === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' : ''}
                          ${req.status === 'en_route' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                          ${req.status === 'in_progress' ? 'bg-[var(--color-brutal-blue)] text-white bg-black' : ''}
                          ${req.status === 'payment_pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                          ${req.status === 'completed' ? 'bg-[var(--color-brutal-teal)] text-black' : ''}
                          ${req.status === 'declined' ? 'bg-[var(--color-brutal-red)] text-black' : ''}
                        `}>
                          {req.status === 'countered' ? (req.lastCounterBy === 'customer' ? 'ACTION REQUIRED' : 'AWAITING CUSTOMER') : req.status === 'declined' ? (req.declinedBy === 'artisan' ? 'TECHNICIAN DECLINED' : 'CUSTOMER DECLINED') : req.status.replace('_', ' ')}
                        </span>
                        <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">
                          {req.isBroadcast && req.status === "pending" ? "Broadcast Request" : "Job Details"}
                        </h3>
                        <p className="text-sm text-black font-bold flex items-center gap-2 uppercase tracking-widest">
                          <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.neighborhood}</span>
                          <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {req.preferredTime}</span>
                        </p>
                      </div>
                      
                      {/* Price Tag */}
                      <div className="bg-[var(--color-brutal-bg)] brutal-border p-4 text-right min-w-[200px] shadow-[4px_4px_0_0_#000]">
                        <p className="text-xs text-black font-black uppercase tracking-widest mb-1 bg-white inline-block px-1 border-2 border-black -rotate-2">
                          {req.status === "countered" ? "Your Counter Offer" : "Customer's Offer"}
                        </p>
                        <p className="text-4xl font-black text-black tracking-tighter mt-1">₦{currentPrice.toLocaleString()}</p>
                        <div className="mt-4 space-y-1 text-sm font-bold border-t-2 border-black pt-2">
                          <p className="text-[var(--color-brutal-red)] flex justify-between">
                            <span>Platform Fee {isPromoActive ? "(0% PROMO)" : "(20%)"}</span> 
                            {isPromoActive ? (
                              <span className="text-[var(--color-brutal-teal)]">FREE</span>
                            ) : (
                              <span>-₦{platformFee.toLocaleString()}</span>
                            )}
                          </p>
                          <p className="text-[var(--color-brutal-teal)] flex justify-between text-lg font-black mt-2">
                            <span className="uppercase">Your Earnings</span> <span>₦{artisanTakeHome.toLocaleString()}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-[var(--color-brutal-yellow)] p-5 brutal-border mb-6 shadow-[2px_2px_0_0_#000]">
                      <p className="text-black font-bold leading-relaxed">{req.description}</p>
                    </div>

                    {req.status === "cancelled" && req.cancelledReason && (
                      <div className="bg-red-100 p-5 brutal-border mb-6 shadow-[2px_2px_0_0_#000] border-red-500">
                        <p className="font-black text-red-900 flex items-center gap-2 mb-1 uppercase tracking-widest"><AlertTriangle className="w-5 h-5" /> Job Cancelled</p>
                        <p className="font-bold text-red-800">{req.cancelledReason}</p>
                      </div>
                    )}

                    {/* Pending Status Actions */}
                    {(req.status === "pending" || (req.status === "countered" && req.lastCounterBy === "customer")) && (
                      <div className="space-y-4">
                        {showCounterFor !== req.requestId ? (
                          <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                              disabled={isRestricted}
                              onClick={() => handleUpdateStatus(req.requestId, "accepted")}
                              className={`flex-1 py-4 text-lg brutal-btn ${isRestricted ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-[var(--color-brutal-teal)]'}`}
                            >
                              ACCEPT JOB
                            </button>
                            <button 
                              disabled={isRestricted}
                              onClick={() => setShowCounterFor(req.requestId)}
                              className={`flex-1 py-4 text-lg brutal-btn ${isRestricted ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'bg-[var(--color-brutal-yellow)]'}`}
                            >
                              COUNTER OFFER
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(req.requestId, "declined")}
                              className="flex-none bg-[var(--color-brutal-red)] py-4 text-lg brutal-btn"
                            >
                              DECLINE
                            </button>
                          </div>
                        ) : (
                          <div className="bg-[var(--color-brutal-pink)] brutal-border p-6 shadow-[4px_4px_0_0_#000]">
                            <h4 className="font-black text-black mb-4 uppercase text-2xl tracking-tighter border-b-2 border-black pb-2 inline-block">Make a Counter Offer</h4>
                            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                              <div className="relative flex-1">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-black text-xl">₦</span>
                                <input
                                  type="number"
                                  placeholder="10000"
                                  value={counterInputs[req.requestId] || ""}
                                  onChange={(e) => setCounterInputs({ ...counterInputs, [req.requestId]: e.target.value })}
                                  className="w-full pl-12 pr-4 py-4 brutal-border bg-white focus:outline-none text-black font-black text-xl"
                                />
                              </div>
                              <div className="flex gap-4">
                                <button
                                  onClick={() => setShowCounterFor(null)}
                                  className="px-6 py-4 bg-white brutal-btn text-lg"
                                >
                                  CANCEL
                                </button>
                                <button
                                  onClick={() => submitCounterOffer(req.requestId)}
                                  className="px-8 py-4 bg-[var(--color-brutal-teal)] brutal-btn text-lg"
                                >
                                  SEND
                                </button>
                              </div>
                            </div>
                            
                            {typingVal > 0 && (
                              <div className="flex gap-6 text-sm font-black uppercase mt-4 bg-white brutal-border p-3">
                                <span className="text-[var(--color-brutal-red)]">
                                  Platform Cut: {isPromoActive ? 'FREE' : `-₦${dynamicFee.toLocaleString()}`}
                                </span>
                                <span className="text-[var(--color-brutal-teal)]">You Keep: ₦{dynamicTakeHome.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {req.status === "accepted" && (
                      <div className="mt-6">
                        <button 
                          onClick={() => handleUpdateStatus(req.requestId, "en_route")}
                          className="w-full bg-[var(--color-brutal-blue)] py-5 text-xl brutal-btn"
                        >
                          I'M ON MY WAY
                        </button>
                      </div>
                    )}

                    {req.status === "en_route" && (
                      <div className="mt-6">
                        <button 
                          onClick={() => handleUpdateStatus(req.requestId, "in_progress")}
                          className="w-full bg-[var(--color-brutal-teal)] py-5 text-xl brutal-btn"
                        >
                          START JOB
                        </button>
                      </div>
                    )}

                    {req.status === "in_progress" && (
                      <div className="mt-6">
                        <button 
                          onClick={() => handleUpdateStatus(req.requestId, "payment_pending")}
                          className="w-full bg-[var(--color-brutal-yellow)] py-5 text-xl brutal-btn"
                        >
                          MARK JOB AS FINISHED
                        </button>
                      </div>
                    )}

                    {["accepted", "en_route", "in_progress", "payment_pending"].includes(req.status) && (
                      <div className="mt-4 flex flex-col gap-4">
                        {req.status === "en_route" && (
                          <Link 
                            href={`/technician/jobs/${req.requestId}/navigate`} 
                            className="w-full bg-black text-white border-4 border-black font-black uppercase text-center block py-4 hover:bg-[var(--color-brutal-blue)] hover:text-black transition-colors brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                          >
                            <span className="flex items-center justify-center gap-2"><MapIcon className="w-5 h-5" /> NAVIGATE TO CUSTOMER</span>
                          </Link>
                        )}
                        <Link href={`/chat/${req.requestId}`} className="w-full bg-white border-4 border-black font-black uppercase text-center block py-4 hover:bg-[var(--color-brutal-bg)] transition-colors brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                          <span className="flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> CHAT WITH CUSTOMER</span>
                        </Link>
                      </div>
                    )}

                    {["accepted", "en_route"].includes(req.status) && (
                      <div className="mt-4 flex flex-col gap-4">
                        {req.rescheduleStatus === "pending" ? (
                          req.rescheduleRequestedBy === "customer" ? (
                            <div className="bg-[var(--color-brutal-yellow)] p-4 border-4 border-black">
                              <p className="font-black text-black uppercase mb-2">Customer requested to reschedule to: <br/>{req.newPreferredTime}</p>
                              <div className="flex gap-2">
                                <button onClick={() => handleRespondReschedule(req.requestId, "accepted", req.newPreferredTime!)} className="flex-1 bg-[var(--color-brutal-teal)] text-black border-2 border-black font-black uppercase py-2">Accept</button>
                                <button onClick={() => handleRespondReschedule(req.requestId, "declined", "")} className="flex-1 bg-[var(--color-brutal-red)] text-white border-2 border-black font-black uppercase py-2">Decline</button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white p-4 border-4 border-black text-center font-black uppercase text-sm">
                              Waiting for customer to accept reschedule
                            </div>
                          )
                        ) : (
                          reschedulingJob === req.requestId ? (
                            <div className="bg-[var(--color-brutal-pink)] p-4 border-4 border-black flex flex-col gap-2">
                              <label className="font-black uppercase text-sm">New Date</label>
                              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="p-2 border-2 border-black font-bold" />
                              <label className="font-black uppercase text-sm">New Time</label>
                              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="p-2 border-2 border-black font-bold" />
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => handleRequestReschedule(req.requestId)} className="flex-1 bg-black text-white border-2 border-black font-black uppercase py-2">Submit</button>
                                <button onClick={() => setReschedulingJob(null)} className="flex-1 bg-white text-black border-2 border-black font-black uppercase py-2">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setReschedulingJob(req.requestId);
                                setNewDate("");
                                setNewTime("");
                              }}
                              className="w-full bg-[var(--color-brutal-yellow)] text-black border-4 border-black font-black uppercase text-center py-4 hover:bg-black hover:text-white transition-colors brutal-shadow-sm"
                            >
                              <span className="flex items-center justify-center gap-2"><Calendar className="w-5 h-5" /> REQUEST RESCHEDULE</span>
                            </button>
                          )
                        )}
                      </div>
                    )}

                    {["pending", "accepted"].includes(req.status) && (
                      <div className="mt-4">
                        <button 
                          onClick={() => {
                            if (confirm("Are you sure you want to cancel this job?")) {
                              handleUpdateStatus(req.requestId, "cancelled");
                            }
                          }}
                          className="w-full bg-[var(--color-brutal-red)] text-white border-4 border-black font-black uppercase text-center py-4 hover:bg-black transition-colors brutal-shadow-sm"
                        >
                          <span className="flex items-center justify-center gap-2"><X className="w-5 h-5 stroke-[3]" /> CANCEL JOB</span>
                        </button>
                      </div>
                    )}

                    {req.status === "payment_pending" && (
                      <div className="mt-6 p-4 bg-[var(--color-brutal-yellow)] border-4 border-black brutal-shadow text-center">
                        <h4 className="font-black uppercase mb-4">Waiting for Payment</h4>
                        {req.proofOfPaymentUrl && (
                          <div className="mb-4">
                            <p className="font-bold text-sm mb-2">Customer uploaded Proof of Payment:</p>
                            <a 
                              href={req.proofOfPaymentUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-block bg-white px-4 py-2 border-2 border-black font-black uppercase brutal-shadow-sm hover:-translate-y-1 transition-transform"
                            >
                              VIEW PROOF OF PAYMENT
                            </a>
                          </div>
                        )}
                        <button 
                          onClick={() => handleUpdateStatus(req.requestId, "completed")}
                          className="w-full bg-[var(--color-brutal-green)] py-4 text-xl brutal-btn"
                        >
                          CONFIRM PAYMENT RECEIVED
                        </button>
                      </div>
                    )}
                  {["accepted", "en_route", "in_progress", "completed", "payment_pending"].includes(req.status) && (
                    <div className="mt-6 pt-4 border-t-2 border-black/10 flex flex-col gap-3">
                      {req.status === "in_progress" && (
                        <button 
                          onClick={() => handleSOS(req.requestId)}
                          className="w-full bg-red-600 text-white py-3 border-4 border-black font-black uppercase tracking-widest text-lg hover:bg-red-700 transition-colors brutal-shadow-sm flex items-center justify-center gap-2"
                        >
                          <PhoneCall className="w-5 h-5 fill-current" /> SOS / PANIC BUTTON
                        </button>
                      )}
                      <button 
                        onClick={() => setReportingJob(req)}
                        className="text-xs font-black uppercase text-gray-500 hover:text-[var(--color-brutal-red)] transition-colors flex items-center justify-center gap-1 mx-auto"
                      >
                        <AlertTriangle className="w-3 h-3 stroke-[3]" /> REPORT AN ISSUE
                      </button>
                    </div>
                  )}
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
              ? { ...req, paidToPlatform: true } 
              : req
          ));
        }}
      />

      {reportingJob && auth.currentUser && (
        <ReportModal 
          jobId={reportingJob.requestId}
          reportedUserId={reportingJob.customerId}
          reporterUserId={auth.currentUser.uid}
          reporterRole="artisan"
          onClose={() => setReportingJob(null)}
        />
      )}
    </div>
  );
}
