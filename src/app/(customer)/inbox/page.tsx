"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { JobRequest } from "@/types";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function InboxPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "job_requests"),
          where("customerId", "==", user.uid)
        );
        
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          requestId: doc.id,
          ...doc.data()
        })) as JobRequest[];

        // Sort by createdAt descending (client-side since we didn't index this specifically yet)
        data.sort((a, b) => b.createdAt - a.createdAt);
        
        setRequests(data);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchRequests();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
        return { icon: Clock, color: "bg-[var(--color-brutal-yellow)]", text: "Pending Review" };
      case "accepted":
        return { icon: CheckCircle, color: "bg-[var(--color-brutal-green)]", text: "Accepted" };
      case "rejected":
        return { icon: XCircle, color: "bg-[var(--color-brutal-red)]", text: "Declined" };
      case "completed":
        return { icon: CheckCircle, color: "bg-[var(--color-brutal-blue)]", text: "Completed" };
      default:
        return { icon: AlertCircle, color: "bg-gray-200", text: status };
    }
  };

  return (
    <div className="max-w-xl mx-auto pt-16 px-6">
      <h1 className="text-[3rem] font-black text-black tracking-tighter uppercase leading-none mb-8 drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
        INBOX
      </h1>

      {loading ? (
        <div className="bg-white border-4 border-black p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex justify-center">
          <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white border-4 border-black p-10 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center">
          <InboxIcon className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-black uppercase text-black mb-2">No Messages</h2>
          <p className="text-black font-bold">You don't have any job requests yet.</p>
          <Link href="/explore" className="inline-block mt-6 px-6 py-3 bg-[var(--color-brutal-green)] border-4 border-black font-black uppercase hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
            Find an Artisan
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((request) => {
            const { icon: StatusIcon, color, text } = getStatusDisplay(request.status);
            const date = new Date(request.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            
            return (
              <div key={request.requestId} className="bg-white border-4 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <div className={`absolute top-0 right-0 px-3 py-1 border-b-4 border-l-4 border-black font-black text-xs uppercase flex items-center gap-1 ${color}`}>
                  <StatusIcon className="w-3 h-3" /> {text}
                </div>
                
                <p className="text-xs font-black text-black bg-[var(--color-brutal-pink)] inline-block px-2 border-2 border-black -rotate-2 mb-3">
                  {date}
                </p>
                
                <h3 className="text-xl font-black uppercase text-black mb-1">{request.subcategory}</h3>
                <p className="text-black font-bold text-sm mb-4">Request sent to artisan</p>
                
                {request.status === "accepted" && (
                  <div className="mt-4 pt-4 border-t-4 border-black border-dashed">
                    <p className="text-sm font-black text-black">The artisan has accepted your offer!</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InboxIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
