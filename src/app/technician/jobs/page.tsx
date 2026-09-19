"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";

export default function ArtisanDashboard() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounterFor, setShowCounterFor] = useState<string | null>(null);
  const [promoDaysLeft, setPromoDaysLeft] = useState<number | null>(null);
  const [showPromoOverlay, setShowPromoOverlay] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const fetchRequests = async () => {
        try {
          const directQ = query(
            collection(db, "jobRequests"),
            where("artisanId", "==", user.uid)
          );
          
          const broadcastQ = query(
            collection(db, "jobRequests"),
            where("isBroadcast", "==", true),
            where("status", "==", "pending")
          );

          const [directSnapshot, broadcastSnapshot, artisanSnapshot] = await Promise.all([
            getDocs(directQ),
            getDocs(broadcastQ),
            getDocs(query(collection(db, "artisans"), where("artisanId", "==", user.uid)))
          ]);

          let validServices: { trade: string, subcategory: string }[] = [];

          if (!artisanSnapshot.empty) {
            const artisanData = artisanSnapshot.docs[0].data();
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
          }

          const directResults = directSnapshot.docs.map(doc => doc.data() as JobRequest);
          const allBroadcastResults = broadcastSnapshot.docs.map(doc => doc.data() as JobRequest);
          
          // Only show broadcast jobs that match the artisan's services
          const matchedBroadcastResults = allBroadcastResults.filter(job => 
            validServices.some(svc => svc.trade === job.trade && svc.subcategory === job.subcategory)
          );

          // Combine and deduplicate
          const combined = [...directResults, ...matchedBroadcastResults];
          const uniqueResults = Array.from(new Map(combined.map(item => [item.requestId, item])).values());
          
          uniqueResults.sort((a, b) => b.createdAt - a.createdAt);
          setRequests(uniqueResults);
        } catch (error) {
          console.error("Error fetching requests:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchRequests();
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (requestId: string, newStatus: JobRequest['status'], counterAmt: number | null = null) => {
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      
      const updatePayload: any = { 
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
        const platformFeeRate = isPromoActive ? 0 : 0.35;
        updatePayload.counterOfferAmount = counterAmt;
        updatePayload.platformFee = counterAmt * platformFeeRate;
      }

      await updateDoc(reqRef, updatePayload);
      
      setRequests(prev => prev.map(req => {
        if (req.requestId === requestId) {
          const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
          const platformFeeRate = isPromoActive ? 0 : 0.35;
          return { 
            ...req, 
            status: newStatus, 
            ...(newStatus === "countered" ? { counterOfferAmount: counterAmt, platformFee: counterAmt! * platformFeeRate } : {}) 
          };
        }
        return req;
      }));
      setShowCounterFor(null);
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const submitCounterOffer = (reqId: string) => {
    const val = parseInt(counterInputs[reqId]?.replace(/,/g, '') || "0", 10);
    if (!isNaN(val) && val > 0) {
      handleUpdateStatus(reqId, "countered", val);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pt-12 px-4 md:px-12 pb-24 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">Job Requests</h1>
        <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-[var(--color-brutal-yellow)] inline-block pr-3 mb-10 -rotate-1 shadow-[2px_2px_0_0_#000]">Manage incoming and active jobs.</p>


        <h2 className="text-3xl font-black text-black mb-6 uppercase tracking-tighter border-b-4 border-black pb-2 inline-block">Recent Job Requests</h2>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <GlobalSpinner text="LOADING REQUESTS" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white p-12 text-center brutal-border brutal-shadow-sm">
            <div className="w-20 h-20 bg-[var(--color-brutal-pink)] brutal-border flex items-center justify-center mx-auto mb-4 rotate-6">
              <span className="text-3xl">📭</span>
            </div>
            <h3 className="text-2xl font-black text-black mb-2 uppercase">No Requests Yet</h3>
            <p className="text-black font-bold">When customers request your services, they will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((req) => {
              const currentPrice = req.status === "countered" && req.counterOfferAmount 
                ? req.counterOfferAmount 
                : (req.offerAmount || 0);
              
              const isPromoActive = promoDaysLeft !== null && promoDaysLeft > 0;
              const platformFeeRate = isPromoActive ? 0 : 0.35;
              
              const platformFee = currentPrice * platformFeeRate;
              const artisanTakeHome = currentPrice - platformFee;

              // For dynamic counter offer calculation
              const typingVal = parseInt(counterInputs[req.requestId]?.replace(/,/g, '') || "0", 10);
              const dynamicFee = typingVal * platformFeeRate;
              const dynamicTakeHome = typingVal - dynamicFee;

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
                          {req.status === 'countered' ? 'Awaiting Customer' : req.status}
                        </span>
                        <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">
                          {req.isBroadcast && req.status === "pending" ? "Broadcast Request" : "Job Details"}
                        </h3>
                        <p className="text-sm text-black font-bold flex items-center gap-2 uppercase tracking-widest">
                          <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1">📍 {req.neighborhood}</span>
                          <span className="bg-[var(--color-brutal-bg)] border-2 border-black px-2 py-1">🕒 {req.preferredTime}</span>
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
                            <span>Platform Fee {isPromoActive ? "(0% PROMO)" : "(35%)"}</span> 
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

                    {/* Pending Status Actions */}
                    {req.status === "pending" && (
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
                          onClick={() => handleUpdateStatus(req.requestId, "payment_pending")}
                          className="w-full bg-[var(--color-brutal-blue)] py-5 text-xl brutal-btn"
                        >
                          MARK JOB AS FINISHED
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
              We've waived our standard 35% platform fee. Any job you accept or counter-offer during this period will have absolutely zero fees taken out. Go make that money!
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
    </div>
  );
}
