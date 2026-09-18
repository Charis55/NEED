"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, runTransaction } from "firebase/firestore";
import { JobRequest, ArtisanProfile } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { useAlert } from "@/components/AlertProvider";

export default function CustomerJobsPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingJob, setReviewingJob] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchRequests = async () => {
      const user = auth.currentUser;
      if (!user) return; 

      try {
        const q = query(collection(db, "jobRequests"), where("customerId", "==", user.uid));
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

    // Minor delay to ensure auth state is loaded in simple client implementations
    const timer = setTimeout(() => fetchRequests(), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdateStatus = async (requestId: string, newStatus: JobRequest['status']) => {
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      await updateDoc(reqRef, { status: newStatus });
      setRequests(prev => prev.map(req => 
        req.requestId === requestId ? { ...req, status: newStatus } : req
      ));
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
          {requests.map((req) => (
            <div key={req.requestId} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2
                      ${req.status === 'pending' ? 'bg-amber-100 text-amber-800' : ''}
                      ${req.status === 'countered' ? 'bg-purple-100 text-purple-800' : ''}
                      ${req.status === 'accepted' ? 'bg-blue-100 text-blue-800' : ''}
                      ${req.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                      ${req.status === 'declined' ? 'bg-red-100 text-red-800' : ''}
                    `}>
                      {req.status === 'countered' ? 'Action Required' : req.status}
                    </span>
                    <p className="text-sm text-gray-500 mb-1">Requested: {new Date(req.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md mb-4 border border-gray-100">
                  <p className="text-gray-800 mb-2">{req.description}</p>
                  <div className="text-sm text-gray-600 font-medium">
                    <p>Initial Offer: ₦{req.offerAmount?.toLocaleString()}</p>
                    {req.counterOfferAmount && (
                      <p className="text-purple-700 mt-1 font-bold">Technician's Counter Offer: ₦{req.counterOfferAmount?.toLocaleString()}</p>
                    )}
                  </div>
                </div>

                {req.status === "countered" && (
                  <div className="flex gap-4 mt-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <div className="flex-1">
                      <p className="text-sm text-purple-900 font-medium mb-3">The artisan has proposed a new price.</p>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleUpdateStatus(req.requestId, "accepted")}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl transition"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(req.requestId, "declined")}
                          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-2.5 px-6 rounded-xl transition"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {req.status === "completed" && !req.reviewed && reviewingJob !== req.requestId && (
                  <button 
                    onClick={() => setReviewingJob(req.requestId)}
                    className="text-blue-600 font-medium hover:underline"
                  >
                    Leave a Review
                  </button>
                )}

                {req.status === "completed" && req.reviewed && (
                  <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg inline-block text-sm font-bold">
                    ✓ Reviewed
                  </div>
                )}

                {reviewingJob === req.requestId && (
                  <form onSubmit={(e) => handleSubmitReview(e, req)} className="bg-blue-50 p-6 rounded-lg mt-4">
                    <h3 className="font-bold text-blue-900 mb-4">Review this job</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-blue-900 mb-2">Rating (1-5)</label>
                      <input 
                        type="number" min="1" max="5" 
                        value={rating} onChange={e => setRating(Number(e.target.value))}
                        className="w-full p-2 rounded border border-blue-200 text-gray-900"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-blue-900 mb-2">Comment</label>
                      <textarea 
                        value={comment} onChange={e => setComment(e.target.value)}
                        className="w-full p-2 rounded border border-blue-200 text-gray-900"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-4">
                      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
                        Submit Review
                      </button>
                      <button type="button" onClick={() => setReviewingJob(null)} className="text-blue-600 hover:underline">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
