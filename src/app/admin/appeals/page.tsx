"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { adminFetch } from "@/utils/adminClient";
import { 
  Scale, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  User, 
  ExternalLink,
  Eye,
  RefreshCw,
  X
} from "lucide-react";

interface AppealItem {
  strikeId: string;
  userId: string;
  userType?: "artisan" | "customer";
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userRole?: string;
  strikeNumber: number;
  reason: string;
  evidenceSummary: string;
  appealStatus?: "none" | "pending" | "approved" | "rejected";
  appealNote?: string;
  appealEvidencePhotos?: string[];
  appealedAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNote?: string;
  issuedAt: number;
  expiresAt: number;
  active: boolean;
}

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchAppeals = async () => {
    try {
      setLoading(true);
      const res = await adminFetch(`/api/admin/appeals?status=${statusFilter}`);
      const data = await res.json();
      if (data.appeals) {
        setAppeals(data.appeals);
      }
    } catch (err: any) {
      console.error("Error fetching strike appeals:", err);
      setFeedbackMsg({ type: "error", text: "Failed to load appeals." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, [statusFilter]);

  const handleReview = async (strikeId: string, decision: "approved" | "rejected") => {
    const note = resolutionNotes[strikeId] || "";
    const confirmPrompt = decision === "approved"
      ? "Are you sure you want to APPROVE this appeal?\n\nThis will clear the strike. If the user was banned, suspended, ranking-penalized, or blacklisted, their account and NIN/phone/email will be automatically restored."
      : "Are you sure you want to REJECT this appeal?\n\nThe strike will remain active.";

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    try {
      setProcessingId(strikeId);
      setFeedbackMsg(null);

      const res = await adminFetch("/api/admin/appeals/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strikeId,
          adminId: "admin_console",
          decision,
          resolutionNote: note.trim() || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedbackMsg({
          type: "success",
          text: `Appeal ${decision.toUpperCase()}! ${data.message}`
        });
        setResolutionNotes(prev => {
          const updated = { ...prev };
          delete updated[strikeId];
          return updated;
        });
        fetchAppeals();
      } else {
        setFeedbackMsg({ type: "error", text: data.error || "Failed to process review" });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = appeals.filter(a => a.appealStatus === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0_0_#000] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Scale className="w-7 h-7 text-[var(--color-brutal-yellow,#FFD700)] bg-black p-1 border border-black" />
            Strike Appeals & Due Process Desk
          </h2>
          <p className="text-sm text-gray-600 font-bold mt-1 max-w-3xl">
            Review challenges submitted by artisans and customers. Approving an appeal voids the strike and automatically restores account privileges, wallet clearance, ranking multipliers, and deletes blacklist entries.
          </p>
        </div>
        <button
          onClick={fetchAppeals}
          disabled={loading}
          className="px-4 py-2 bg-[var(--color-brutal-yellow,#FFD700)] text-black border-2 border-black font-black uppercase text-xs flex items-center gap-2 hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Global Status Message */}
      {feedbackMsg && (
        <div className={`p-4 border-4 border-black font-black text-sm uppercase flex items-center justify-between ${
          feedbackMsg.type === "success" ? "bg-green-100 text-green-950" : "bg-red-100 text-red-950"
        }`}>
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:bg-black hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b-2 border-black pb-2">
        {(["pending", "approved", "rejected", "all"] as const).map((tab) => {
          const isActive = statusFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 font-black text-xs uppercase border-2 border-black transition-all ${
                isActive
                  ? "bg-black text-white shadow-[2px_2px_0_0_#000] -translate-y-0.5"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              {tab === "pending" ? "Pending Appeals" : tab === "approved" ? "Approved & Restored" : tab === "rejected" ? "Rejected" : "All Records"}
            </button>
          );
        })}
      </div>

      {/* Appeals List */}
      {loading ? (
        <div className="p-12 text-center bg-white border-4 border-black font-black uppercase tracking-wide">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-black" />
          Loading appeals...
        </div>
      ) : appeals.length === 0 ? (
        <div className="p-12 text-center bg-white border-4 border-black font-black uppercase text-gray-500">
          No {statusFilter !== "all" ? statusFilter : ""} strike appeals found. The queue is clean.
        </div>
      ) : (
        <div className="space-y-6">
          {appeals.map((appeal) => {
            const isPending = appeal.appealStatus === "pending";
            const isApproved = appeal.appealStatus === "approved";
            const isRejected = appeal.appealStatus === "rejected";

            return (
              <div 
                key={appeal.strikeId}
                className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-5"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-red-600 text-white font-black text-xs uppercase px-2.5 py-1 border-2 border-black">
                      Strike #{appeal.strikeNumber}
                    </span>
                    <span className={`font-black text-xs uppercase px-2.5 py-1 border-2 border-black ${
                      appeal.userType === "artisan" ? "bg-amber-300 text-black" : "bg-sky-200 text-black"
                    }`}>
                      Role: {appeal.userType || appeal.userRole || "User"}
                    </span>
                    <span className={`font-black text-xs uppercase px-2.5 py-1 border-2 border-black ${
                      isPending ? "bg-yellow-300 text-black animate-pulse" : isApproved ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    }`}>
                      Status: {appeal.appealStatus?.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-gray-500">
                      Strike ID: {appeal.strikeId}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-gray-600">
                    {appeal.appealedAt ? `Appealed: ${new Date(appeal.appealedAt).toLocaleString()}` : `Issued: ${new Date(appeal.issuedAt).toLocaleString()}`}
                  </div>
                </div>

                {/* User & Strike Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* User Card */}
                  <div className="bg-gray-50 border-2 border-black p-4 space-y-1">
                    <p className="text-xs font-black uppercase text-gray-500 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Appellant Information
                    </p>
                    <p className="font-black text-base text-black">{appeal.userName || "Unknown"}</p>
                    <p className="text-xs font-bold text-gray-700">Email: {appeal.userEmail || "N/A"}</p>
                    <p className="text-xs font-bold text-gray-700">Phone: {appeal.userPhone || "N/A"}</p>
                    <p className="text-xs font-mono text-gray-500">UID: {appeal.userId}</p>
                  </div>

                  {/* Violation Card */}
                  <div className="bg-red-50 border-2 border-black p-4 space-y-1">
                    <p className="text-xs font-black uppercase text-red-600 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Violation Reason & Evidence
                    </p>
                    <p className="font-black text-sm text-black">{appeal.reason}</p>
                    <div className="text-xs font-mono text-red-900 bg-white p-2 border border-red-300 mt-1">
                      <strong>Surveillance Summary:</strong> {appeal.evidenceSummary || "Automated circumvention trigger."}
                    </div>
                  </div>
                </div>

                {/* Appeal Reason & Evidence Photos */}
                <div className="bg-[var(--color-brutal-bg,#FFFDF0)] border-4 border-black p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-black" />
                    <h4 className="font-black text-sm uppercase tracking-wide">
                      Appellant's Defense Statement
                    </h4>
                  </div>

                  <div className="bg-white border-2 border-black p-4 font-bold text-sm text-black whitespace-pre-wrap leading-relaxed shadow-[2px_2px_0_0_#000]">
                    "{appeal.appealNote || "No written explanation provided."}"
                  </div>

                  {/* Evidence Photos */}
                  {appeal.appealEvidencePhotos && appeal.appealEvidencePhotos.length > 0 ? (
                    <div>
                      <p className="text-xs font-black uppercase text-gray-700 mb-2">
                        Attached Supporting Evidence ({appeal.appealEvidencePhotos.length} files):
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {appeal.appealEvidencePhotos.map((photoUrl, idx) => (
                          <div 
                            key={idx}
                            onClick={() => setSelectedImage(photoUrl)}
                            className="relative w-28 h-28 border-2 border-black bg-white cursor-pointer group shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-all"
                          >
                            <Image
                              src={photoUrl}
                              alt={`Evidence ${idx + 1}`}
                              fill
                              sizes="112px"
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <Eye className="w-5 h-5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-gray-500 italic">No photo attachments uploaded with this appeal.</p>
                  )}
                </div>

                {/* Review Resolution Section */}
                {isPending ? (
                  <div className="pt-3 border-t-2 border-black space-y-3">
                    <label className="block text-xs font-black uppercase text-gray-700">
                      Admin Decision Note (Optional explanation for audit log and appellant):
                    </label>
                    <textarea
                      rows={2}
                      value={resolutionNotes[appeal.strikeId] || ""}
                      onChange={(e) => setResolutionNotes({ ...resolutionNotes, [appeal.strikeId]: e.target.value })}
                      placeholder="e.g. Evidence reviewed; verified customer agreed to legitimate on-platform rescheduling..."
                      className="w-full p-2.5 border-2 border-black text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    />

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleReview(appeal.strikeId, "approved")}
                        disabled={processingId === appeal.strikeId}
                        className="px-5 py-2.5 bg-green-500 text-white font-black text-xs uppercase border-2 border-black flex items-center gap-2 hover:bg-green-600 transition-all shadow-[2px_2px_0_0_#000] disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {processingId === appeal.strikeId ? "Processing..." : "Approve Appeal & Restore Account"}
                      </button>

                      <button
                        onClick={() => handleReview(appeal.strikeId, "rejected")}
                        disabled={processingId === appeal.strikeId}
                        className="px-5 py-2.5 bg-red-600 text-white font-black text-xs uppercase border-2 border-black flex items-center gap-2 hover:bg-red-700 transition-all shadow-[2px_2px_0_0_#000] disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        {processingId === appeal.strikeId ? "Processing..." : "Reject Appeal (Uphold Strike)"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 border-2 border-black text-xs font-bold ${
                    isApproved ? "bg-green-50 text-green-900 border-green-700" : "bg-red-50 text-red-900 border-red-700"
                  }`}>
                    <p className="font-black uppercase flex items-center gap-1 mb-1">
                      {isApproved ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      Resolution: {appeal.appealStatus?.toUpperCase()} by {appeal.resolvedBy || "Admin"}
                    </p>
                    <p>
                      <strong>Resolved At:</strong> {appeal.resolvedAt ? new Date(appeal.resolvedAt).toLocaleString() : "N/A"}
                    </p>
                    {appeal.resolutionNote && (
                      <p className="mt-1">
                        <strong>Resolution Note:</strong> {appeal.resolutionNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal for Photo Inspection */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-4 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-[8px_8px_0_0_#000] relative">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black mb-3">
              <h3 className="font-black uppercase text-sm">Evidence Inspection</h3>
              <div className="flex items-center gap-2">
                <a
                  href={selectedImage}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 bg-yellow-300 border-2 border-black font-black text-xs uppercase flex items-center gap-1 hover:bg-yellow-400"
                >
                  <ExternalLink className="w-3 h-3" /> Full Size
                </a>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-1 bg-black text-white hover:bg-red-600 border border-black"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 relative min-h-[350px] w-full bg-gray-100 border border-gray-300">
              <Image
                src={selectedImage}
                alt="Enlarged evidence"
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
