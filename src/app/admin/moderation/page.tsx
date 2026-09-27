"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from "firebase/firestore";
import { ShieldAlert, CheckCircle, XCircle, Trash2, Image as ImageIcon, MessageSquare, Star } from "lucide-react";
import Link from "next/link";
import GlobalSpinner from "@/components/GlobalSpinner";

type ReportType = "photo" | "chat" | "review";
type ModerationStatus = "pending" | "resolved" | "dismissed";

interface Report {
  id: string;
  type: ReportType;
  targetId: string; // The ID of the photo, chat message, or review
  reportedBy: string;
  reason: string;
  status: ModerationStatus;
  createdAt: number;
  metadata?: any; // Additional context (e.g. image URL, chat text)
}

export default function ModerationPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportType | "all">("all");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // In a real app, you would have a "reports" collection
      const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
    } catch (error) {
      console.error("Error fetching reports:", error);
      // Fallback/Mock data for demonstration if collection doesn't exist
      setReports([
        {
          id: "r1",
          type: "photo",
          targetId: "photo123",
          reportedBy: "user_customer1",
          reason: "Inappropriate content",
          status: "pending",
          createdAt: Date.now() - 3600000,
          metadata: { url: "https://via.placeholder.com/150", artisanId: "artisan_1" }
        },
        {
          id: "r2",
          type: "chat",
          targetId: "msg456",
          reportedBy: "user_artisan2",
          reason: "Harassment",
          status: "pending",
          createdAt: Date.now() - 7200000,
          metadata: { text: "I refuse to pay you this amount!", jobId: "job_789" }
        },
        {
          id: "r3",
          type: "review",
          targetId: "rev101",
          reportedBy: "user_artisan1",
          reason: "Fake review/Spam",
          status: "resolved",
          createdAt: Date.now() - 86400000,
          metadata: { text: "Terrible service, never showed up.", rating: 1 }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (reportId: string, action: ModerationStatus) => {
    try {
      // await updateDoc(doc(db, "reports", reportId), { status: action });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: action } : r));
    } catch (err) {
      console.error("Action failed", err);
    }
  };

  const filteredReports = activeTab === "all" ? reports : reports.filter(r => r.type === activeTab);

  if (loading) return <GlobalSpinner text="LOADING MODERATION QUEUE" />;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-black text-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_#CCFF00]">
        <div>
          <Link href="/admin" className="text-[#CCFF00] font-black uppercase tracking-widest text-sm mb-4 inline-block hover:underline">
            ← Back to Admin
          </Link>
          <h1 className="text-4xl font-black uppercase tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-10 h-10" /> Content Moderation
          </h1>
          <p className="text-gray-300 font-bold max-w-2xl mt-2">
            Review reported photos, chats, and reviews to enforce community guidelines.
          </p>
        </div>
        <div className="bg-[#CCFF00] text-black px-4 py-2 border-2 border-[#CCFF00] font-black uppercase">
          {reports.filter(r => r.status === "pending").length} Pending
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b-4 border-black pb-4 overflow-x-auto">
        {(["all", "photo", "chat", "review"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 border-4 border-black font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab
                ? "bg-[var(--color-brutal-teal)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]"
                : "bg-white hover:bg-gray-100"
            }`}
          >
            {tab === "photo" && <ImageIcon className="w-4 h-4" />}
            {tab === "chat" && <MessageSquare className="w-4 h-4" />}
            {tab === "review" && <Star className="w-4 h-4" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="space-y-6">
        {filteredReports.length === 0 ? (
          <div className="bg-white border-4 border-black p-12 text-center font-black uppercase tracking-widest text-gray-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            No reports found in this category.
          </div>
        ) : (
          filteredReports.map(report => (
            <div key={report.id} className={`bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row gap-6 ${report.status !== 'pending' ? 'opacity-70' : ''}`}>
              
              {/* Type Icon */}
              <div className="shrink-0 flex items-center justify-center w-16 h-16 bg-gray-100 border-2 border-black">
                {report.type === "photo" && <ImageIcon className="w-8 h-8 text-black" />}
                {report.type === "chat" && <MessageSquare className="w-8 h-8 text-black" />}
                {report.type === "review" && <Star className="w-8 h-8 text-black" />}
              </div>

              {/* Details */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 text-xs font-black uppercase border-2 border-black ${
                    report.status === 'pending' ? 'bg-[var(--color-brutal-yellow)] text-black' :
                    report.status === 'resolved' ? 'bg-[var(--color-brutal-green)] text-black' :
                    'bg-gray-300 text-black'
                  }`}>
                    {report.status}
                  </span>
                  <span className="text-sm font-bold text-gray-500 uppercase">
                    Reported {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                
                <h3 className="text-xl font-black uppercase tracking-tighter mb-1">
                  Reason: {report.reason}
                </h3>
                <p className="text-sm font-bold text-gray-600 mb-4 uppercase">
                  Reported by ID: {report.reportedBy}
                </p>

                {/* Context / Metadata */}
                <div className="bg-gray-100 border-2 border-gray-300 p-4 font-mono text-sm">
                  {report.type === "photo" && report.metadata?.url && (
                    <img src={report.metadata.url} alt="Reported" className="max-w-xs border-2 border-black" />
                  )}
                  {report.type === "chat" && report.metadata?.text && (
                    <div className="border-l-4 border-black pl-4">
                      "{report.metadata.text}"
                    </div>
                  )}
                  {report.type === "review" && report.metadata?.text && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1 text-[var(--color-brutal-yellow)]">
                        {Array.from({length: 5}).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < (report.metadata.rating||0) ? 'fill-current' : 'text-gray-400'}`} />
                        ))}
                      </div>
                      <div className="border-l-4 border-black pl-4">
                        "{report.metadata.text}"
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {report.status === "pending" && (
                <div className="flex flex-col gap-3 shrink-0 min-w-[150px]">
                  <button 
                    onClick={() => handleAction(report.id, "resolved")}
                    className="w-full bg-[var(--color-brutal-red)] text-white font-black uppercase py-3 border-4 border-black hover:bg-black transition-colors shadow-[4px_4px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Content
                  </button>
                  <button 
                    onClick={() => handleAction(report.id, "dismissed")}
                    className="w-full bg-white text-black font-black uppercase py-3 border-4 border-black hover:bg-gray-200 transition-colors shadow-[4px_4px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Dismiss
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
