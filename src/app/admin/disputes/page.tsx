"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import GlobalSpinner from "@/components/GlobalSpinner";
import { AlertTriangle, ExternalLink, ShieldAlert, CheckCircle, Search } from "lucide-react";

interface Dispute {
  id: string;
  jobId: string | null;
  reportedUserId: string;
  reporterUserId: string;
  reporterRole: "customer" | "artisan";
  category: string;
  description: string;
  evidenceUrl: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: any;
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "dismissed">("open");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "disputes"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispute));
      setDisputes(data);
    } catch (error) {
      console.error("Error fetching disputes:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: "resolved" | "dismissed" | "open") => {
    try {
      await updateDoc(doc(db, "disputes", id), { status: newStatus });
      setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    }
  };

  const filteredDisputes = disputes.filter(d => {
    if (filter !== "all" && d.status !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        d.id.toLowerCase().includes(term) ||
        d.reportedUserId.toLowerCase().includes(term) ||
        d.reporterUserId.toLowerCase().includes(term) ||
        d.description.toLowerCase().includes(term) ||
        (d.jobId && d.jobId.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-[var(--color-brutal-bg)] pb-24 font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="px-6 md:px-12 pt-12 pb-6 flex justify-between items-end border-b-4 border-black bg-[var(--color-brutal-teal)]">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-black uppercase tracking-tighter leading-none mb-2">
            Disputes & Reports
          </h1>
          <p className="font-bold text-gray-800 uppercase text-sm md:text-base">Trust & Safety Command Center</p>
        </div>
        <Link 
          href="/admin"
          className="bg-white text-black px-6 py-2 font-black uppercase brutal-border hover:bg-[var(--color-brutal-yellow)] transition-colors"
        >
          BACK TO DASHBOARD
        </Link>
      </div>

      <div className="px-6 md:px-12 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex bg-white brutal-border overflow-hidden">
            {(["all", "open", "resolved", "dismissed"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-3 font-black uppercase border-r-4 border-black last:border-r-0 ${filter === f ? 'bg-black text-white' : 'hover:bg-[var(--color-brutal-yellow)]'}`}
              >
                {f}
              </button>
            ))}
          </div>
          
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by ID, User, or Description..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white brutal-border font-bold uppercase focus:outline-none focus:bg-[var(--color-brutal-pink)] transition-colors"
            />
          </div>
        </div>

        {loading ? (
          <GlobalSpinner text="LOADING DISPUTES..." />
        ) : filteredDisputes.length === 0 ? (
          <div className="bg-white p-12 brutal-border text-center">
            <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-2xl font-black uppercase text-gray-400">No Disputes Found</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredDisputes.map(dispute => (
              <div key={dispute.id} className="bg-white brutal-border p-6 md:p-8 flex flex-col md:flex-row gap-6 relative">
                {/* Status Badge */}
                <div className={`absolute top-0 right-0 px-4 py-1 font-black uppercase border-l-4 border-b-4 border-black ${
                  dispute.status === "open" ? "bg-[var(--color-brutal-red)] text-white" :
                  dispute.status === "resolved" ? "bg-[var(--color-brutal-green)] text-black" :
                  "bg-gray-200 text-black"
                }`}>
                  {dispute.status}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-black text-white px-2 py-0.5 text-xs font-black uppercase">
                      {dispute.category}
                    </span>
                    <span className="text-gray-500 font-bold text-sm">
                      {new Date(dispute.createdAt?.toDate?.() || Date.now()).toLocaleString()}
                    </span>
                  </div>
                  
                  <p className="font-medium text-lg leading-snug mb-4 border-l-4 border-[var(--color-brutal-red)] pl-4 py-1 bg-red-50">
                    "{dispute.description}"
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-bold uppercase bg-gray-100 p-4 border-2 border-black">
                    <div>
                      <p className="text-gray-500 mb-1">Reporter ({dispute.reporterRole})</p>
                      <Link href={`/admin/${dispute.reporterRole === 'customer' ? 'customer' : 'technician'}/${dispute.reporterUserId}`} className="text-blue-600 hover:underline flex items-center gap-1 break-all">
                        {dispute.reporterUserId} <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Reported User ({dispute.reporterRole === 'customer' ? 'artisan' : 'customer'})</p>
                      <Link href={`/admin/${dispute.reporterRole === 'customer' ? 'technician' : 'customer'}/${dispute.reportedUserId}`} className="text-blue-600 hover:underline flex items-center gap-1 break-all">
                        {dispute.reportedUserId} <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    {dispute.jobId && (
                      <div className="sm:col-span-2">
                        <p className="text-gray-500 mb-1">Related Job ID</p>
                        <span className="bg-[var(--color-brutal-yellow)] px-2 py-0.5 border-2 border-black font-mono">
                          {dispute.jobId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px]">
                  {dispute.evidenceUrl && (
                    <a 
                      href={dispute.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-black text-white px-4 py-3 font-black uppercase text-center border-4 border-black hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" /> View Evidence
                    </a>
                  )}

                  {dispute.status === "open" && (
                    <>
                      <button 
                        onClick={() => updateStatus(dispute.id, "resolved")}
                        className="bg-[var(--color-brutal-green)] text-black px-4 py-3 font-black uppercase text-center border-4 border-black brutal-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Mark Resolved
                      </button>
                      <button 
                        onClick={() => updateStatus(dispute.id, "dismissed")}
                        className="bg-gray-200 text-black px-4 py-3 font-black uppercase text-center border-4 border-black brutal-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                      >
                        Dismiss Report
                      </button>
                    </>
                  )}
                  {dispute.status !== "open" && (
                    <button 
                      onClick={() => updateStatus(dispute.id, "open")}
                      className="bg-white text-black px-4 py-3 font-black uppercase text-center border-4 border-black hover:bg-gray-100 transition-all text-xs"
                    >
                      Reopen Dispute
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
