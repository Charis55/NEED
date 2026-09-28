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
import { AlertTriangle, Wrench, MapPin, Clock, MessageSquare, Calendar, X, Star, CheckCircle, RefreshCw, FileText, PhoneCall } from "lucide-react";

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
    let unsubscribe: () => void;

    const fetchRequests = () => {
      const user = auth.currentUser;
      if (!user) return; 

      const q = query(collection(db, "jobRequests"), where("customerId", "==", user.uid));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(doc => doc.data() as JobRequest);
        results.sort((a, b) => b.createdAt - a.createdAt);
        setRequests(results);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching requests:", error);
        setLoading(false);
      });
    };

    // Minor delay to ensure auth state is loaded in simple client implementations
    const timer = setTimeout(() => fetchRequests(), 1000);
    return () => {
      clearTimeout(timer);
      if (unsubscribe) unsubscribe();
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
        newPreferredTime: `${newDate} at ${newTime}`,
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
            const currentPrice = req.status === "countered" && req.counterOfferAmount 
              ? req.counterOfferAmount 
              : (req.offerAmount || 0);

            return (
              <div key={req.requestId} className="bg-white brutal-border brutal-shadow-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex flex-col h-full">
                <div className="p-6 md:p-8 flex flex-col flex-grow">
                  <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4 mb-6 border-b-4 border-black pb-6 flex-grow">
                    <div>
                      <span className={`inline-block px-4 py-2 text-xs font-black uppercase tracking-widest mb-3 brutal-border
                        ${req.status === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                        ${req.status === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                        ${req.status === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' : ''}
                        ${req.status === 'en_route' ? 'bg-[var(--color-brutal-teal)] text-black' : ''}
                        ${req.status === 'in_progress' ? 'bg-[#bbf7d0] text-black' : ''}
                        ${req.status === 'completed' ? 'bg-[var(--color-brutal-teal)] text-black border-dashed' : ''}
                        ${req.status === 'declined' ? 'bg-[var(--color-brutal-red)] text-white' : ''}
                        ${req.status === 'cancelled' ? 'bg-gray-800 text-white' : ''}
                      `}>
                        {req.status === 'countered' ? (req.lastCounterBy === 'customer' ? 'AWAITING TECHNICIAN' : 'ACTION REQUIRED') : req.status === 'declined' ? (req.declinedBy === 'customer' ? 'CUSTOMER DECLINED' : 'TECHNICIAN DECLINED') : req.status.replace('_', ' ')}
                      </span>
                      <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">
                        {req.trade} - {req.subcategory}
                      </h3>
                      <p className="text-sm text-black font-bold flex items-center gap-2 uppercase tracking-widest">
                        <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.neighborhood}</span>
                        <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {req.preferredTime}</span>
                      </p>
                    </div>
                    
                    {/* Price Tag */}
                    <div className="bg-[var(--color-brutal-bg)] brutal-border p-4 text-right min-w-[200px] shadow-[4px_4px_0_0_#000]">
                      <p className="text-xs text-black font-black uppercase tracking-widest mb-1 bg-white inline-block px-1 border-2 border-black -rotate-2">
                        {req.status === "countered" 
                          ? (req.lastCounterBy === 'customer' ? "Your Counter Offer" : "Technician's Counter")
                          : "Your Offer"}
                      </p>
                      <p className="text-4xl font-black text-black tracking-tighter mt-1">₦{currentPrice.toLocaleString()}</p>
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

                  {req.status === "countered" && req.lastCounterBy !== "customer" && (
                    <div className="space-y-4">
                      {showCounterFor !== req.requestId ? (
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button 
                            onClick={() => handleUpdateStatus(req.requestId, "accepted")}
                            className="flex-1 bg-[var(--color-brutal-teal)] py-4 text-lg brutal-btn"
                          >
                            ACCEPT JOB
                          </button>
                          <button 
                            onClick={() => setShowCounterFor(req.requestId)}
                            className="flex-1 bg-[var(--color-brutal-yellow)] py-4 text-lg brutal-btn"
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
                        <div className="bg-[var(--color-brutal-bg)] p-6 brutal-border border-dashed">
                          <label className="block text-sm font-black text-black mb-2 uppercase">Your New Offer Amount (₦)</label>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <input
                              type="text"
                              value={counterInputs[req.requestId] || ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setCounterInputs(prev => ({ ...prev, [req.requestId]: val ? Number(val).toLocaleString() : "" }));
                              }}
                              placeholder="e.g. 5,000"
                              className="flex-1 p-4 bg-white brutal-border text-xl font-black focus:outline-none focus:bg-[var(--color-brutal-yellow)]"
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleUpdateStatus(req.requestId, "countered", parseInt(counterInputs[req.requestId]?.replace(/,/g, '') || "0", 10))}
                                className="bg-black text-white px-8 font-black uppercase hover:bg-[var(--color-brutal-teal)] hover:text-black brutal-border transition-colors whitespace-nowrap"
                              >
                                SEND COUNTER
                              </button>
                              <button 
                                onClick={() => {
                                  setShowCounterFor(null);
                                  setCounterInputs(prev => ({ ...prev, [req.requestId]: "" }));
                                }}
                                className="bg-[var(--color-brutal-red)] px-6 font-black uppercase brutal-border"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {["accepted", "en_route", "in_progress", "payment_pending"].includes(req.status) && (
                    <div className="mt-4 flex flex-col gap-4">
                      <Link href={`/chat/${req.requestId}`} className="w-full bg-white border-4 border-black font-black uppercase text-center block py-4 hover:bg-[var(--color-brutal-bg)] transition-colors brutal-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                        <span className="flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> CHAT WITH TECHNICIAN</span>
                      </Link>
                    </div>
                  )}

                  {["accepted", "en_route"].includes(req.status) && (
                    <div className="mt-4 flex flex-col gap-4">
                      {req.rescheduleStatus === "pending" ? (
                        req.rescheduleRequestedBy === "artisan" ? (
                          <div className="bg-[var(--color-brutal-yellow)] p-4 border-4 border-black">
                            <p className="font-black text-black uppercase mb-2">Technician requested to reschedule to: <br/>{req.newPreferredTime}</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleRespondReschedule(req.requestId, "accepted", req.newPreferredTime!)} className="flex-1 bg-[var(--color-brutal-teal)] text-black border-2 border-black font-black uppercase py-2">Accept</button>
                              <button onClick={() => handleRespondReschedule(req.requestId, "declined", "")} className="flex-1 bg-[var(--color-brutal-red)] text-white border-2 border-black font-black uppercase py-2">Decline</button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white p-4 border-4 border-black text-center font-black uppercase text-sm">
                            Waiting for technician to accept reschedule
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

                  {req.status === "en_route" && (
                    <div className="flex gap-4 mt-4">
                      <a href={`/jobs/${req.requestId}/track`} className="flex-1 bg-black text-white px-6 py-4 font-black uppercase brutal-border text-center hover:bg-[var(--color-brutal-yellow)] hover:text-black transition-colors block">
                        <span className="flex items-center justify-center gap-2"><MapPin className="w-5 h-5" /> TRACK TECHNICIAN</span>
                      </a>
                    </div>
                  )}

                  {req.status === "completed" && (
                    <div className="flex flex-col sm:flex-row gap-4 mt-4">
                      {!req.reviewed && reviewingJob !== req.requestId && (
                        <button 
                          onClick={() => setReviewingJob(req.requestId)}
                          className="flex-1 bg-[var(--color-brutal-blue)] text-black px-6 py-3 font-black uppercase brutal-border shadow-[4px_4px_0_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                        >
                          <span className="flex items-center justify-center gap-2"><Star className="w-5 h-5" /> LEAVE A REVIEW</span>
                        </button>
                      )}
                      {req.reviewed && (
                        <div className="flex-none bg-white border-4 border-black text-black px-4 py-3 text-sm font-black uppercase shadow-[4px_4px_0_0_#000] -rotate-2 self-start flex items-center justify-center">
                          <span className="flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> REVIEWED</span>
                        </div>
                      )}
                      <a 
                        href={`/artisans/${req.artisanId}/request?trade=${encodeURIComponent(req.trade)}&subcategory=${encodeURIComponent(req.subcategory)}&desc=${encodeURIComponent(req.description)}`}
                        className="flex-1 bg-[var(--color-brutal-yellow)] text-black px-6 py-3 font-black uppercase brutal-border text-center hover:-translate-y-1 transition-transform block"
                      >
                        <span className="flex items-center justify-center gap-2"><RefreshCw className="w-5 h-5" /> BOOK AGAIN</span>
                      </a>
                      <a 
                        href={`/jobs/${req.requestId}/receipt`}
                        className="flex-1 bg-white text-black px-6 py-3 font-black uppercase brutal-border text-center hover:-translate-y-1 transition-transform block"
                      >
                        <span className="flex items-center justify-center gap-2"><FileText className="w-5 h-5" /> RECEIPT</span>
                      </a>
                    </div>
                  )}

                  {reviewingJob === req.requestId && (
                    <form onSubmit={(e) => handleSubmitReview(e, req)} className="bg-[var(--color-brutal-blue)] p-6 brutal-border shadow-[4px_4px_0_0_#000] mt-4">
                      <h3 className="text-2xl font-black text-black mb-4 uppercase">Review this job</h3>
                      <div className="mb-4">
                        <label className="block text-sm font-black text-black mb-2 uppercase">Rating (1-5)</label>
                        <input 
                          type="number" min="1" max="5" 
                          value={rating} onChange={e => setRating(Number(e.target.value))}
                          className="w-full p-4 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-yellow)] font-black text-xl"
                        />
                      </div>
                      <div className="mb-6">
                        <label className="block text-sm font-black text-black mb-2 uppercase">Comment</label>
                        <textarea 
                          value={comment} onChange={e => setComment(e.target.value)}
                          className="w-full p-4 bg-white brutal-border focus:outline-none focus:bg-[var(--color-brutal-yellow)] font-bold"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-4">
                        <button type="submit" className="bg-black text-white px-8 py-3 font-black uppercase hover:bg-white hover:text-black brutal-border transition-colors">
                          Submit Review
                        </button>
                        <button type="button" onClick={() => setReviewingJob(null)} className="bg-white text-black px-8 py-3 font-black uppercase brutal-border hover:bg-[var(--color-brutal-red)] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </form>
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
