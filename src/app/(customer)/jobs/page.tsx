"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, runTransaction, onSnapshot } from "firebase/firestore";
import { JobRequest, ArtisanProfile } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";

export default function CustomerJobsPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingJob, setReviewingJob] = useState<string | null>(null);
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
      
      const updatePayload: any = { 
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
    <div className="max-w-4xl mx-auto pt-16 px-4 pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] mt-4">
        MY BOOKINGS
      </h1>
      
      {loading ? (
        <GlobalSpinner text="LOADING YOUR REQUESTS" />
      ) : requests.length === 0 ? (
        <div className="bg-[var(--color-brutal-yellow)] brutal-border p-12 text-center shadow-[8px_8px_0_0_#000] rotate-1 max-w-2xl mx-auto my-12">
          <div className="w-24 h-24 bg-white border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_#000] -rotate-6">
            <span className="text-5xl">🛠️</span>
          </div>
          <h2 className="text-3xl font-black text-black uppercase tracking-tighter mb-4">No Bookings Yet!</h2>
          <p className="text-black font-bold text-lg bg-white border-2 border-black inline-block px-4 py-2 -rotate-1">
            When you request a job, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((req) => {
            const currentPrice = req.status === "countered" && req.counterOfferAmount 
              ? req.counterOfferAmount 
              : (req.offerAmount || 0);

            return (
              <div key={req.requestId} className="bg-white brutal-border brutal-shadow-sm hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform mb-6">
                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 border-b-4 border-black pb-6">
                    <div>
                      <span className={`inline-block px-4 py-2 text-xs font-black uppercase tracking-widest mb-3 brutal-border
                        ${req.status === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' : ''}
                        ${req.status === 'countered' ? 'bg-[var(--color-brutal-pink)] text-black' : ''}
                        ${req.status === 'accepted' ? 'bg-[var(--color-brutal-blue)] text-black' : ''}
                        ${req.status === 'completed' ? 'bg-[var(--color-brutal-teal)] text-black' : ''}
                        ${req.status === 'declined' ? 'bg-[var(--color-brutal-red)] text-black' : ''}
                      `}>
                        {req.status === 'countered' ? (req.lastCounterBy === 'customer' ? 'AWAITING TECHNICIAN' : 'ACTION REQUIRED') : req.status === 'declined' ? (req.declinedBy === 'customer' ? 'CUSTOMER DECLINED' : 'TECHNICIAN DECLINED') : req.status}
                      </span>
                      <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">
                        {req.trade} - {req.subcategory}
                      </h3>
                      <p className="text-sm text-black font-bold flex items-center gap-2 uppercase tracking-widest">
                        <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1">📍 {req.neighborhood}</span>
                        <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1">🕒 {req.preferredTime}</span>
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

                  {req.status === "completed" && !req.reviewed && reviewingJob !== req.requestId && (
                    <button 
                      onClick={() => setReviewingJob(req.requestId)}
                      className="bg-[var(--color-brutal-blue)] text-black px-6 py-3 font-black uppercase brutal-border shadow-[4px_4px_0_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                    >
                      ★ LEAVE A REVIEW
                    </button>
                  )}

                  {req.status === "completed" && req.reviewed && (
                    <div className="bg-white border-4 border-black text-black px-4 py-2 inline-block text-sm font-black uppercase shadow-[4px_4px_0_0_#000] -rotate-2">
                      ✓ REVIEWED
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
