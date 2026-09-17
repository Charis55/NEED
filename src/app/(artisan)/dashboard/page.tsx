"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { JobRequest } from "@/types";

export default function ArtisanDashboard() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounterFor, setShowCounterFor] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      const user = auth.currentUser;
      if (!user) return; // In a real app, protect this route via middleware

      try {
        const q = query(
          collection(db, "jobRequests"),
          where("artisanId", "==", user.uid)
        );
        
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => doc.data() as JobRequest);
        
        results.sort((a, b) => b.createdAt - a.createdAt);
        setRequests(results);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const handleUpdateStatus = async (requestId: string, newStatus: JobRequest['status'], counterAmt: number | null = null) => {
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      
      const updatePayload: any = { 
        status: newStatus 
      };

      if (newStatus === "completed") {
        updatePayload.completedAt = Date.now();
      }

      if (newStatus === "countered" && counterAmt) {
        updatePayload.counterOfferAmount = counterAmt;
        updatePayload.platformFee = counterAmt * 0.35;
      }

      await updateDoc(reqRef, updatePayload);
      
      setRequests(prev => prev.map(req => {
        if (req.requestId === requestId) {
          return { 
            ...req, 
            status: newStatus, 
            ...(newStatus === "countered" ? { counterOfferAmount: counterAmt, platformFee: counterAmt! * 0.35 } : {}) 
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
    <div className="min-h-screen bg-[var(--color-brutal-bg)] pb-20 selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Top Banner */}
      <div className="bg-[var(--color-brutal-blue)] pt-16 pb-24 px-6 md:px-12 border-b-4 border-black brutal-shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-5xl md:text-7xl font-black text-black mb-2 tracking-tighter uppercase">DASHBOARD</h1>
            <p className="text-black font-bold text-lg border-l-4 border-black pl-3 bg-white inline-block pr-3 -rotate-1">Manage your jobs and earnings.</p>
          </div>
          <div className="hidden md:block bg-[var(--color-brutal-yellow)] border-4 border-black p-6 brutal-shadow-sm rotate-2">
            <p className="text-black text-sm font-black mb-1 uppercase tracking-widest">Available Balance</p>
            <p className="text-4xl font-black text-black">₦0.00</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-12 -mt-10">
        {/* Mobile Earnings Card */}
        <div className="md:hidden bg-[var(--color-brutal-yellow)] border-4 border-black p-6 brutal-shadow-sm mb-8 flex items-center justify-between -rotate-1">
          <div>
            <p className="text-black text-sm font-black mb-1 uppercase tracking-widest">Available Balance</p>
            <p className="text-3xl font-black text-black">₦0.00</p>
          </div>
        </div>

        <h2 className="text-3xl font-black text-black mb-6 uppercase tracking-tighter border-b-4 border-black pb-2 inline-block">Recent Job Requests</h2>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="text-4xl animate-bounce">🛠️</div>
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
              
              const platformFee = currentPrice * 0.35;
              const artisanTakeHome = currentPrice - platformFee;

              // For dynamic counter offer calculation
              const typingVal = parseInt(counterInputs[req.requestId]?.replace(/,/g, '') || "0", 10);
              const dynamicFee = typingVal * 0.35;
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
                        <h3 className="text-3xl font-black text-black mb-1 uppercase tracking-tighter">Job Details</h3>
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
                            <span>Platform Fee (35%)</span> <span>-₦{platformFee.toLocaleString()}</span>
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
                            
                            {/* Live Calculation */}
                            {typingVal > 0 && (
                              <div className="flex gap-6 text-sm font-black uppercase mt-4 bg-white brutal-border p-3">
                                <span className="text-[var(--color-brutal-red)]">Platform Cut: -₦{dynamicFee.toLocaleString()}</span>
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
                          onClick={() => handleUpdateStatus(req.requestId, "completed")}
                          className="w-full bg-[var(--color-brutal-blue)] py-5 text-xl brutal-btn"
                        >
                          MARK JOB AS COMPLETED
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
    </div>
  );
}
