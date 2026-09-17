"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from "firebase/firestore";
import { JobRequest } from "@/types";

export default function ArtisanDashboard() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      const user = auth.currentUser;
      if (!user) return; // In a real app, protect this route via middleware

      try {
        const q = query(
          collection(db, "jobRequests"),
          where("artisanId", "==", user.uid),
          // orderBy("createdAt", "desc") // requires composite index if combined with where, omitted for MVP
        );
        
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => doc.data() as JobRequest);
        
        // Sort client-side to avoid Firestore index requirement for MVP
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

  const handleUpdateStatus = async (requestId: string, newStatus: JobRequest['status']) => {
    try {
      const reqRef = doc(db, "jobRequests", requestId);
      await updateDoc(reqRef, { 
        status: newStatus,
        ...(newStatus === "completed" ? { completedAt: Date.now() } : {})
      });
      
      // Update local state
      setRequests(prev => prev.map(req => 
        req.requestId === requestId ? { ...req, status: newStatus } : req
      ));
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Job Requests</h1>
      
      {loading ? (
        <p className="text-slate-400">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="bg-slate-800 rounded-lg shadow p-8 border border-slate-700 text-center">
          <p className="text-slate-400 text-lg">No job requests yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((req) => (
            <div key={req.requestId} className="bg-slate-800 rounded-lg shadow border border-slate-700 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2
                      ${req.status === 'pending' ? 'bg-amber-500/20 text-amber-500' : ''}
                      ${req.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' : ''}
                      ${req.status === 'completed' ? 'bg-green-500/20 text-green-400' : ''}
                      ${req.status === 'declined' ? 'bg-red-500/20 text-red-400' : ''}
                    `}>
                      {req.status}
                    </span>
                    <p className="text-sm text-slate-400 mb-1">Requested: {new Date(req.createdAt).toLocaleString()}</p>
                    <p className="text-sm text-slate-400 font-medium">📍 {req.neighborhood} | 🕒 {req.preferredTime}</p>
                  </div>
                </div>
                
                <div className="bg-slate-900 p-4 rounded-md mb-6">
                  <p className="text-slate-200">{req.description}</p>
                </div>

                {req.status === "pending" && (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleUpdateStatus(req.requestId, "accepted")}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition"
                    >
                      Accept Job
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(req.requestId, "declined")}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 px-4 rounded-lg transition"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {req.status === "accepted" && (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleUpdateStatus(req.requestId, "completed")}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition"
                    >
                      Mark as Completed
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
