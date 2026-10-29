"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { adminFetch } from "@/utils/adminClient";
import { Award, AlertTriangle, CheckCircle, XCircle, RefreshCw, DollarSign, ShieldAlert, Image as ImageIcon } from "lucide-react";

export default function AdminGuaranteePage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "resolved">("pending");

  // Action modal state
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [actionType, setActionType] = useState<"redo_arranged" | "refunded_clawback" | "rejected" | null>(null);
  const [notes, setNotes] = useState("");
  const [refundNaira, setRefundNaira] = useState("");
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, "guaranteeClaims"), orderBy("createdAt", "desc")));
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading guarantee claims:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const openActionModal = (claim: any, type: "redo_arranged" | "refunded_clawback" | "rejected") => {
    setSelectedClaim(claim);
    setActionType(type);
    setNotes("");
    setRefundNaira("");
    setActionError("");
    setActionSuccess("");
  };

  const closeActionModal = () => {
    setSelectedClaim(null);
    setActionType(null);
    setNotes("");
    setRefundNaira("");
    setActionError("");
  };

  const handleExecuteResolution = async () => {
    if (!selectedClaim || !actionType) return;
    if (notes.trim().length < 5) {
      setActionError("Please enter a detailed resolution note (at least 5 characters).");
      return;
    }

    try {
      setProcessing(true);
      setActionError("");

      const adminId = auth.currentUser?.uid || "admin_system";
      const clawbackAmountKobo = refundNaira ? Math.round(Number(refundNaira) * 100) : undefined;

      const res = await adminFetch("/api/guarantee/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: selectedClaim.id || selectedClaim.claimId,
          adminId,
          resolution: actionType,
          notes,
          clawbackAmountKobo
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to resolve guarantee claim");
      }

      setActionSuccess(`Claim resolved successfully with status '${actionType}'!`);
      setTimeout(() => {
        closeActionModal();
        fetchClaims();
      }, 1200);
    } catch (err: any) {
      setActionError(err.message || "Failed to execute resolution");
    } finally {
      setProcessing(false);
    }
  };

  const filteredClaims = claims.filter(c => {
    const isResolved = ["redo_arranged", "refunded_clawback", "rejected"].includes(c.status);
    if (activeTab === "pending") return !isResolved;
    if (activeTab === "resolved") return isResolved;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0_0_#000]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Award className="w-7 h-7 text-purple-600" />
              30-Day Workmanship Guarantee Claims
            </h2>
            <p className="text-sm text-gray-600 font-bold mt-1">
              Protected by NEED: Quality assurance disputes for on-platform settled bookings.
            </p>
          </div>
          <button
            onClick={fetchClaims}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 font-black uppercase text-xs border-2 border-black hover:bg-[var(--color-brutal-yellow)] hover:text-black transition-colors self-start"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-6 border-b-2 border-black pb-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 font-black text-xs uppercase border-2 border-black transition-all ${
              activeTab === "pending"
                ? "bg-[var(--color-brutal-yellow)] text-black shadow-[2px_2px_0_0_#000]"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Pending Review ({claims.filter(c => !["redo_arranged", "refunded_clawback", "rejected"].includes(c.status)).length})
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={`px-4 py-2 font-black text-xs uppercase border-2 border-black transition-all ${
              activeTab === "resolved"
                ? "bg-[var(--color-brutal-teal)] text-black shadow-[2px_2px_0_0_#000]"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Resolved History ({claims.filter(c => ["redo_arranged", "refunded_clawback", "rejected"].includes(c.status)).length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 font-black text-xs uppercase border-2 border-black transition-all ${
              activeTab === "all"
                ? "bg-black text-white shadow-[2px_2px_0_0_#000]"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            All Claims ({claims.length})
          </button>
        </div>
      </div>

      {/* Claims List */}
      {loading ? (
        <div className="p-12 text-center bg-white border-4 border-black font-black uppercase tracking-wider animate-pulse">
          Loading guarantee claims queue...
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="p-12 text-center bg-white border-4 border-black font-black uppercase text-gray-500 shadow-[4px_4px_0_0_#000]">
          No {activeTab} guarantee claims found.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredClaims.map((claim) => {
            const isPending = !["redo_arranged", "refunded_clawback", "rejected"].includes(claim.status);

            return (
              <div
                key={claim.id}
                className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-sm uppercase bg-black text-white px-2.5 py-1">
                      CLAIM: {claim.id}
                    </span>
                    <span className="text-xs font-bold text-gray-600">
                      {new Date(claim.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {claim.status === "submitted" || claim.status === "under_review" ? (
                      <span className="px-3 py-1 bg-yellow-400 text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_0_#000]">
                        Pending Review
                      </span>
                    ) : claim.status === "redo_arranged" ? (
                      <span className="px-3 py-1 bg-[var(--color-brutal-blue)] text-white font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_0_#000]">
                        Redo Arranged
                      </span>
                    ) : claim.status === "refunded_clawback" ? (
                      <span className="px-3 py-1 bg-green-500 text-white font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_0_#000]">
                        Refunded & Clawback
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-400 text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0_0_#000]">
                        Rejected
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Meta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 border-2 border-black text-xs font-bold">
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Job ID:</span>
                    <span className="font-mono">{claim.jobId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Customer ID:</span>
                    <span className="font-mono">{claim.customerId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block uppercase text-[10px]">Artisan ID:</span>
                    <span className="font-mono">{claim.artisanId}</span>
                  </div>
                </div>

                {/* Customer Description */}
                <div className="bg-amber-50 p-4 border-2 border-black text-sm">
                  <p className="font-black uppercase text-xs text-amber-900 mb-1 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    Customer Defect Report:
                  </p>
                  <p className="text-gray-800 font-semibold whitespace-pre-wrap">{claim.description}</p>
                </div>

                {/* Photos */}
                {claim.photos && claim.photos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-gray-700 flex items-center gap-1">
                      <ImageIcon className="w-4 h-4" /> Evidence Photos ({claim.photos.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {claim.photos.map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="border-2 border-black bg-white p-1 hover:bg-yellow-200 transition-colors inline-block"
                        >
                          <img src={url} alt={`Evidence ${i+1}`} className="w-20 h-20 object-cover border border-black" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution Status Box for Resolved Claims */}
                {!isPending && (
                  <div className="bg-gray-100 p-4 border-2 border-black space-y-1.5 text-xs">
                    <p className="font-black uppercase text-gray-900 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Resolution Applied:
                    </p>
                    <p className="text-gray-800">
                      <strong>Notes:</strong> {claim.resolutionNotes || "No notes provided."}
                    </p>
                    {claim.refundAmount && (
                      <p className="text-gray-800 font-bold">
                        <strong>Refund Amount:</strong> ₦{(claim.refundAmount / 100).toLocaleString()}
                      </p>
                    )}
                    <p className="text-gray-500 text-[11px]">
                      Resolved at: {claim.resolvedAt ? new Date(claim.resolvedAt).toLocaleString() : "N/A"} by {claim.resolvedBy || "admin"}
                    </p>
                  </div>
                )}

                {/* Action Controls for Pending Claims */}
                {isPending && (
                  <div className="pt-2 flex flex-wrap gap-3">
                    <button
                      onClick={() => openActionModal(claim, "redo_arranged")}
                      className="bg-[var(--color-brutal-blue)] text-white px-4 py-2.5 font-black uppercase text-xs border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-4 h-4" /> Order Artisan Redo (₦0)
                    </button>

                    <button
                      onClick={() => openActionModal(claim, "refunded_clawback")}
                      className="bg-green-600 text-white px-4 py-2.5 font-black uppercase text-xs border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-1.5"
                    >
                      <DollarSign className="w-4 h-4" /> Refund & Clawback
                    </button>

                    <button
                      onClick={() => openActionModal(claim, "rejected")}
                      className="bg-[var(--color-brutal-red)] text-white px-4 py-2.5 font-black uppercase text-xs border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Reject Claim
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Action Modal */}
      {selectedClaim && actionType && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-6 max-w-lg w-full space-y-4">
            <div className="border-b-2 border-black pb-2 flex items-center justify-between">
              <h3 className="text-lg font-black uppercase flex items-center gap-2">
                {actionType === "redo_arranged" && <RefreshCw className="w-5 h-5 text-blue-600" />}
                {actionType === "refunded_clawback" && <DollarSign className="w-5 h-5 text-green-600" />}
                {actionType === "rejected" && <AlertTriangle className="w-5 h-5 text-red-600" />}
                {actionType === "redo_arranged" && "Order Free Redo with Artisan"}
                {actionType === "refunded_clawback" && "Refund Customer & Clawback Wallet"}
                {actionType === "rejected" && "Reject Guarantee Claim"}
              </h3>
              <button
                onClick={closeActionModal}
                disabled={processing}
                className="font-black text-sm px-2 py-1 border-2 border-black hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-bold text-gray-700">
              Claim ID: <span className="font-mono">{selectedClaim.id}</span> | Job ID: <span className="font-mono">{selectedClaim.jobId}</span>
            </p>

            {actionType === "redo_arranged" && (
              <div className="bg-blue-50 border-2 border-black p-3 text-xs text-blue-900 font-bold">
                Instructs the original artisan to redo the defective workmanship at ₦0. Job state will be set back to <strong>in_progress</strong>.
              </div>
            )}

            {actionType === "refunded_clawback" && (
              <div className="space-y-3">
                <div className="bg-green-50 border-2 border-black p-3 text-xs text-green-900 font-bold">
                  Awards platform loyalty credits to the customer and debits the artisan wallet via <code>guarantee_clawback</code>.
                </div>
                <div>
                  <label className="block text-xs font-black uppercase mb-1">
                    Custom Refund Amount (₦ Naira, optional)
                  </label>
                  <input
                    type="number"
                    value={refundNaira}
                    onChange={(e) => setRefundNaira(e.target.value)}
                    placeholder="Leave blank to refund full deposit / agreed price"
                    className="w-full p-2.5 border-2 border-black text-sm font-bold bg-white focus:outline-none focus:bg-yellow-100"
                  />
                </div>
              </div>
            )}

            {actionType === "rejected" && (
              <div className="bg-red-50 border-2 border-black p-3 text-xs text-red-900 font-bold">
                Dismisses the claim as unsubstantiated or outside guarantee coverage. Job status will remain <strong>completed</strong>.
              </div>
            )}

            {/* Resolution Note Field */}
            <div>
              <label className="block text-xs font-black uppercase mb-1">
                Mandatory Resolution Notes:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain the findings, technician communication, and resolution decision..."
                rows={3}
                className="w-full p-2.5 border-2 border-black text-sm font-bold bg-white focus:outline-none focus:bg-yellow-100"
              />
            </div>

            {actionError && (
              <div className="p-3 bg-red-100 border-2 border-red-700 text-red-900 text-xs font-bold">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 bg-green-100 border-2 border-green-700 text-green-900 text-xs font-bold">
                {actionSuccess}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleExecuteResolution}
                disabled={processing || !!actionSuccess}
                className="flex-1 bg-black text-white py-3 font-black uppercase text-xs border-2 border-black hover:bg-[var(--color-brutal-teal)] hover:text-black transition-colors disabled:opacity-50"
              >
                {processing ? "Processing..." : "Confirm Resolution"}
              </button>
              <button
                onClick={closeActionModal}
                disabled={processing}
                className="flex-1 bg-white text-black py-3 font-black uppercase text-xs border-2 border-black hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
