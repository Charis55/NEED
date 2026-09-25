"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  orderBy,
  where,
  deleteDoc,
  arrayUnion,
} from "firebase/firestore";
import { VerificationReviewItem, ArtisanProfile } from "@/types";
import {
  ShieldCheck,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  User,
  Clock,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const POSSAP_PORTAL_URL = "https://pfrps.npf.gov.ng";

export default function VerificationQueuePage() {
  const [queueItems, setQueueItems] = useState<
    (VerificationReviewItem & { artisanProfile?: ArtisanProfile })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const q = query(
        collection(db, "verificationReviewQueue"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const items: (VerificationReviewItem & { artisanProfile?: ArtisanProfile })[] = [];

      for (const docSnap of snapshot.docs) {
        const item = docSnap.data() as VerificationReviewItem;
        // Fetch the full artisan profile for side-by-side comparison
        try {
          const artisanDoc = await getDoc(doc(db, "artisans", item.artisanId));
          if (artisanDoc.exists()) {
            items.push({ ...item, artisanProfile: artisanDoc.data() as ArtisanProfile });
          } else {
            items.push(item);
          }
        } catch {
          items.push(item);
        }
      }

      setQueueItems(items);
    } catch (error) {
      console.error("Error fetching verification queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (artisanId: string) => {
    setActionLoading(artisanId);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not authenticated");

      const logEntry = {
        action: "approved",
        adminId: currentUser.uid,
        adminEmail: currentUser.email || "unknown",
        timestamp: Date.now(),
      };

      // Update artisan profile
      await updateDoc(doc(db, "artisans", artisanId), {
        verified: true,
        available: true,
        manualReviewRequired: false,
        manualReviewReasons: [],
        certificateVerificationStatus: "manually_verified",
        policeClearanceStatus: "manually_verified",
        verificationDecisionLog: arrayUnion(logEntry),
      });

      // Update review queue
      await updateDoc(doc(db, "verificationReviewQueue", artisanId), {
        status: "approved",
        reviewedBy: currentUser.email || currentUser.uid,
        reviewedAt: Date.now(),
      });

      // Update local state
      setQueueItems((prev) =>
        prev.map((item) =>
          item.artisanId === artisanId
            ? { ...item, status: "approved", reviewedAt: Date.now() }
            : item
        )
      );

      // Trigger the approval email via our backend route
      try {
        await fetch('/api/emails/technician-approved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artisanId }),
        });
      } catch (emailErr) {
        console.error("Failed to send approval email, but approval succeeded:", emailErr);
      }
    } catch (error) {
      console.error("Error approving artisan:", error);
      alert("Failed to approve. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (artisanId: string) => {
    const reason = rejectReason[artisanId];
    if (!reason || reason.trim().length === 0) {
      alert("Please provide a rejection reason.");
      return;
    }

    setActionLoading(artisanId);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not authenticated");

      const logEntry = {
        action: "rejected",
        adminId: currentUser.uid,
        adminEmail: currentUser.email || "unknown",
        timestamp: Date.now(),
        reason: reason.trim(),
      };

      // Update artisan profile
      await updateDoc(doc(db, "artisans", artisanId), {
        verified: false,
        available: false,
        certificateVerificationStatus: "rejected",
        policeClearanceStatus: "rejected",
        verificationDecisionLog: arrayUnion(logEntry),
      });

      // Update review queue
      await updateDoc(doc(db, "verificationReviewQueue", artisanId), {
        status: "rejected",
        reviewedBy: currentUser.email || currentUser.uid,
        reviewedAt: Date.now(),
      });

      // Update local state
      setQueueItems((prev) =>
        prev.map((item) =>
          item.artisanId === artisanId
            ? { ...item, status: "rejected", reviewedAt: Date.now() }
            : item
        )
      );
    } catch (error) {
      console.error("Error rejecting artisan:", error);
      alert("Failed to reject. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = queueItems.filter((item) => item.status === filter);

  if (loading) {
    return (
      <div className="text-center py-20 animate-pulse text-gray-500">
        Loading verification queue...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">
            Verification Queue
          </h1>
          <p className="text-gray-600 font-bold max-w-2xl">
            Review flagged artisan profiles with side-by-side document comparison.
          </p>
        </div>

        <div className="flex bg-gray-100 border-4 border-black p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {(["pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 font-black uppercase tracking-widest text-sm transition-all ${
                filter === f
                  ? "bg-[#CCFF00] border-2 border-black"
                  : "text-gray-500 hover:text-black border-2 border-transparent"
              }`}
            >
              {f} ({queueItems.filter((i) => i.status === f).length})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border-4 border-black p-12 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <ShieldCheck className="w-16 h-16 text-black mx-auto mb-4" />
          <h3 className="text-2xl font-black uppercase tracking-widest text-black mb-2">
            No {filter} items
          </h3>
          <p className="font-bold text-gray-500">
            {filter === "pending"
              ? "All caught up! No pending verifications."
              : `No ${filter} items in the queue.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((item) => {
            const isExpanded = expandedId === item.artisanId;
            const profile = item.artisanProfile;

            return (
              <div
                key={item.artisanId}
                className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              >
                {/* Header row */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : item.artisanId)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {item.artisanName}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Flagged reason badges */}
                    <div className="hidden md:flex flex-wrap gap-1">
                      {item.flaggedChecks.slice(0, 3).map((check, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                        >
                          {check.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded detail view */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-6">
                    {/* Flagged reasons */}
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Flagged Reasons
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {item.flaggedChecks.map((check, i) => (
                          <span
                            key={i}
                            className="text-xs font-semibold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {check.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Side-by-side: Identity vs Document */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      {/* Left: Identity Verification Data */}
                      <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
                        <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4" />
                          Verified Identity ({profile?.identityVerificationProvider || "N/A"})
                        </h4>
                        <div className="space-y-2">
                          <p className="text-sm">
                            <span className="font-semibold text-gray-600">Name:</span>{" "}
                            <span className="font-bold text-gray-900">
                              {profile?.identityVerifiedName || item.extractedData.identityVerifiedName || "—"}
                            </span>
                          </p>
                          {profile?.identityVerifiedDOB && (
                            <p className="text-sm">
                              <span className="font-semibold text-gray-600">DOB:</span>{" "}
                              <span className="font-bold text-gray-900">
                                {profile.identityVerifiedDOB}
                              </span>
                            </p>
                          )}
                          <p className="text-sm">
                            <span className="font-semibold text-gray-600">Status:</span>{" "}
                            <span className={`font-bold ${profile?.identityVerificationStatus === "verified" ? "text-emerald-700" : "text-red-700"}`}>
                              {profile?.identityVerificationStatus || "unknown"}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Extracted Document Data */}
                      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                        <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-3 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          Document Extracted Data
                        </h4>
                        <div className="space-y-2">
                          {item.extractedData.certificate ? (
                            <>
                              <p className="text-sm">
                                <span className="font-semibold text-gray-600">Name on Cert:</span>{" "}
                                <span className="font-bold text-gray-900">
                                  {item.extractedData.certificate.applicantNameOnDocument || "—"}
                                </span>
                              </p>
                              <p className="text-sm">
                                <span className="font-semibold text-gray-600">Cert #:</span>{" "}
                                <span className="font-bold text-gray-900 font-mono">
                                  {item.extractedData.certificate.certificateNumber || "—"}
                                </span>
                              </p>
                              <p className="text-sm">
                                <span className="font-semibold text-gray-600">Issuer:</span>{" "}
                                <span className="font-bold text-gray-900">
                                  {item.extractedData.certificate.issuingBody || "—"}
                                </span>
                              </p>
                              <p className="text-sm">
                                <span className="font-semibold text-gray-600">Tamper Score:</span>{" "}
                                <span className={`font-bold ${(item.extractedData.certificate.tamperScore || 0) > 0.6 ? "text-red-700" : "text-emerald-700"}`}>
                                  {((item.extractedData.certificate.tamperScore || 0) * 100).toFixed(0)}%
                                </span>
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              Certificate data not yet extracted (OCR pending)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Police Clearance Section */}
                    {(item.policeClearanceUrl || item.extractedData.policeClearance) && (
                      <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 mb-6">
                        <h4 className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-3 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          Police Clearance
                        </h4>
                        {item.extractedData.policeClearance ? (
                          <div className="space-y-2">
                            <p className="text-sm">
                              <span className="font-semibold text-gray-600">Name:</span>{" "}
                              <span className="font-bold text-gray-900">
                                {item.extractedData.policeClearance.applicantNameOnDocument || "—"}
                              </span>
                            </p>
                            {item.extractedData.policeClearance.possapReferenceNumber && (
                              <div className="flex items-center gap-2">
                                <p className="text-sm">
                                  <span className="font-semibold text-gray-600">POSSAP Ref:</span>{" "}
                                  <span className="font-bold text-purple-900 font-mono text-base">
                                    {item.extractedData.policeClearance.possapReferenceNumber}
                                  </span>
                                </p>
                                <a
                                  href={POSSAP_PORTAL_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-white px-2 py-1 rounded border border-purple-300 hover:bg-purple-100 transition"
                                >
                                  Verify on POSSAP <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            Police clearance data not yet extracted (OCR pending)
                          </p>
                        )}
                      </div>
                    )}

                    {/* Document Images */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {item.certificateUrl && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Certificate Document
                          </h4>
                          <a
                            href={item.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block border border-gray-200 rounded-lg overflow-hidden hover:border-gray-400 transition relative h-48"
                          >
                            <Image
                              src={item.certificateUrl}
                              alt="Certificate"
                              fill
                              className="object-contain bg-gray-50"
                              unoptimized
                            />
                            <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                              <Eye className="w-3 h-3" /> View Full
                            </div>
                          </a>
                        </div>
                      )}
                      {item.policeClearanceUrl && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Police Clearance Document
                          </h4>
                          <a
                            href={item.policeClearanceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block border border-gray-200 rounded-lg overflow-hidden hover:border-gray-400 transition relative h-48"
                          >
                            <Image
                              src={item.policeClearanceUrl}
                              alt="Police Clearance"
                              fill
                              className="object-contain bg-gray-50"
                              unoptimized
                            />
                            <div className="absolute bottom-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                              <Eye className="w-3 h-3" /> View Full
                            </div>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {item.status === "pending" && (
                      <div className="border-t border-gray-100 pt-4 space-y-3">
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApprove(item.artisanId)}
                            disabled={actionLoading === item.artisanId}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <CheckCircle className="w-5 h-5" />
                            {actionLoading === item.artisanId
                              ? "Approving..."
                              : "Approve & Verify"}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Rejection reason (required)..."
                            value={rejectReason[item.artisanId] || ""}
                            onChange={(e) =>
                              setRejectReason((prev) => ({
                                ...prev,
                                [item.artisanId]: e.target.value,
                              }))
                            }
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                          />
                          <button
                            onClick={() => handleReject(item.artisanId)}
                            disabled={
                              actionLoading === item.artisanId ||
                              !rejectReason[item.artisanId]?.trim()
                            }
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Decision info for resolved items */}
                    {item.status !== "pending" && item.reviewedAt && (
                      <div className={`border-t border-gray-100 pt-4 flex items-center gap-2 ${item.status === "approved" ? "text-emerald-700" : "text-red-700"}`}>
                        {item.status === "approved" ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span className="font-semibold capitalize">{item.status}</span>
                        <span className="text-gray-400 text-sm">
                          by {item.reviewedBy} on{" "}
                          {new Date(item.reviewedAt).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    )}
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
