"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { UserAccount, JobRequest } from "@/types";
import { ArrowLeft, User, Phone, MapPin, Calendar, CheckCircle, Clock, XCircle, Settings, Ban } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GlobalSpinner from "@/components/GlobalSpinner";

export default function AdminCustomerProfile() {
  const params = useParams();
  const userId = params.userId as string;
  const [customer, setCustomer] = useState<UserAccount | null>(null);
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchCustomerData();
  }, [userId]);

  const fetchCustomerData = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        setCustomer(userDoc.data() as UserAccount);
      }

      const q = query(
        collection(db, "jobRequests"),
        where("customerId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const jobsSnap = await getDocs(q);
      setJobs(jobsSnap.docs.map(doc => doc.data() as JobRequest));
    } catch (error) {
      console.error("Error fetching customer data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#FFF0E5] flex justify-center items-center"><GlobalSpinner text="LOADING CUSTOMER..." /></div>;
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#FFF0E5] p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 mb-8 bg-white border-2 border-black px-4 py-2 font-black uppercase shadow-[4px_4px_0_0_#000]">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="bg-white border-4 border-black p-12 text-center shadow-[8px_8px_0_0_#000]">
          <h2 className="text-3xl font-black uppercase">Customer Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF0E5] pb-24">
      <div className="bg-[var(--color-brutal-blue)] pt-12 pb-16 px-6 md:px-12 border-b-4 border-black mb-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/admin" className="inline-flex items-center gap-2 mb-8 bg-white border-2 border-black px-4 py-2 font-black uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white border-4 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0_0_#000]">
              <span className="text-4xl font-black">{customer.displayName?.charAt(0) || "U"}</span>
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">{customer.displayName || "Unnamed User"}</h1>
              <p className="font-bold text-lg border-l-4 border-black pl-3 bg-white inline-block pr-3 -rotate-1 mt-2">
                {customer.phone || "No phone number"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 space-y-8">
        
        {/* Profile Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-4 flex items-center gap-2">
              <User className="w-6 h-6" /> User Details
            </h2>
            <div className="space-y-4 font-bold">
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">User ID</span>
                <span className="font-mono text-sm">{customer.userId}</span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">Joined</span>
                <span>{new Date(customer.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">Default Address</span>
                <span className="max-w-[200px] text-right truncate">
                  Not set
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-300 pb-2">
                <span className="text-gray-500 uppercase">Admin Status</span>
                <span className={customer.isAdmin ? "text-emerald-600" : "text-gray-500"}>
                  {customer.isAdmin ? "YES" : "NO"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#FFE5F0] border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
            <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6" /> Preferences
            </h2>
            <div className="space-y-4 font-bold">
              <div className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                <span className="text-gray-700 uppercase">Push Notifications</span>
                <span className={customer.preferences?.pushNotifications ? "text-emerald-700" : "text-red-600"}>
                  {customer.preferences?.pushNotifications ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                <span className="text-gray-700 uppercase">Messaging Notifications</span>
                <span className={customer.preferences?.messagingNotifications ? "text-emerald-700" : "text-red-600"}>
                  {customer.preferences?.messagingNotifications ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <div className="flex justify-between border-b-2 border-dashed border-gray-400 pb-2">
                <span className="text-gray-700 uppercase">Location</span>
                <span className={customer.preferences?.locationEnabled ? "text-emerald-700" : "text-red-600"}>
                  {customer.preferences?.locationEnabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Job History */}
        <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
          <h2 className="text-2xl font-black uppercase border-b-4 border-black pb-2 mb-6">
            Job History ({jobs.length})
          </h2>

          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-bold text-gray-500 uppercase tracking-widest">No jobs found for this customer.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map(job => (
                <div key={job.requestId} className="border-4 border-black p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-black ${
                        job.status === "completed" ? "bg-[var(--color-brutal-green)] text-black" :
                        job.status === "cancelled" || job.status === "declined" ? "bg-red-400 text-black" :
                        "bg-[var(--color-brutal-yellow)] text-black"
                      }`}>
                        {job.status}
                      </span>
                      <span className="font-mono text-xs font-bold text-gray-500">#{job.requestId.slice(-6)}</span>
                    </div>
                    <h3 className="font-black text-lg uppercase tracking-tight">{job.trade} - {job.subcategory}</h3>
                    <div className="text-sm font-bold text-gray-600 flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" /> {job.preferredTime}
                    </div>
                  </div>
                  
                  <div className="text-left md:text-right">
                    <p className="font-black text-xl">
                      ₦{(job.counterOfferAmount || job.offerAmount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-gray-500 uppercase mt-1">
                      Tech ID: {job.artisanId?.slice(0, 8) || "Unassigned"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
