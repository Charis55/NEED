"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { ArtisanProfile, UserAccount } from "@/types";
import {
  BadgeCheck, XCircle, MapPin, Star, ShieldCheck, Users, Wrench, Search,
  Clock, CheckCircle, AlertTriangle, ExternalLink, FileText, UserCheck,
  ClipboardList, ChevronRight,
} from "lucide-react";
import Link from "next/link";

type Tab = "overview" | "applications" | "customers" | "technicians";

// ─── Step completion helpers ───────────────────────────────────────────────
function getSteps(a: ArtisanProfile) {
  return [
    {
      label: "KYC",
      done: !!a.identityVerificationStatus,
    },
    {
      label: "Services",
      done: !!(a.neighborhood && a.neighborhood.length > 0),
    },
    { label: "Skills", done: !!a.yearsOfExperience },
    { label: "Bio", done: !!(a.bio && a.bio.length > 0) },
    {
      label: "Documents",
      done: !!(a.policeClearanceUrl || (a.portfolioPhotoUrls && a.portfolioPhotoUrls.length > 0)),
    },
    { label: "Submitted", done: !!(a.createdAt && a.onboardingStep === 6) },
  ];
}

function KycChip({ artisan }: { artisan: ArtisanProfile }) {
  const status = artisan.identityVerificationStatus;
  if (!status)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-gray-400 text-gray-500 bg-gray-100">
        Not Started
      </span>
    );
  if (status === "verified")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-black bg-[#CCFF00] text-black">
        <CheckCircle className="w-3 h-3" /> KYC Verified
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-red-600 bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> KYC Failed
      </span>
    );
  // anything else → flagged / needs manual didit review
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-amber-500 bg-amber-100 text-amber-800">
      <AlertTriangle className="w-3 h-3" /> Needs Didit Review
    </span>
  );
}

function StepBar({ artisan }: { artisan: ArtisanProfile }) {
  const steps = getSteps(artisan);
  return (
    <div className="flex gap-3 mt-3 flex-wrap">
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-1 w-16">
          <div
            className={`w-7 h-7 border-2 border-black flex items-center justify-center text-xs font-black ${
              s.done ? "bg-[#CCFF00]" : "bg-white text-gray-400"
            }`}
          >
            {s.done ? <CheckCircle className="w-4 h-4 text-black" /> : i + 1}
          </div>
          <span className="text-[9px] font-black uppercase text-gray-500 w-full text-center leading-tight">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [artisans, setArtisans] = useState<ArtisanProfile[]>([]);
  const [customers, setCustomers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [artisanSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "artisans"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"))),
      ]);
      setArtisans(artisanSnap.docs.map((d) => d.data() as ArtisanProfile));
      setCustomers(userSnap.docs.map((d) => d.data() as UserAccount));
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (artisanId: string, status: boolean) => {
    setActionLoading(artisanId);
    try {
      const updateData: any = {
        verified: status,
        available: status,
      };
      if (!status) {
        updateData.certificateVerificationStatus = "rejected";
        updateData.policeClearanceStatus = "rejected";
      }
      await updateDoc(doc(db, "artisans", artisanId), updateData);
      setArtisans((prev) =>
        prev.map((a) =>
          a.artisanId === artisanId
            ? {
                ...a,
                verified: status,
                available: status,
                ...(status === false
                  ? { certificateVerificationStatus: "rejected", policeClearanceStatus: "rejected" }
                  : {}),
              }
            : a
        )
      );
    } catch (error) {
      console.error("Error updating artisan verification:", error);
      alert("Failed to update verification status.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-16 h-16 border-4 border-black border-t-[#CCFF00] rounded-full animate-spin" />
        <div className="font-black uppercase tracking-widest text-lg">Loading Database...</div>
      </div>
    );
  }

  const pendingVerification = artisans.filter((a) => a.manualReviewRequired && !a.verified).length;
  const pendingApplications = artisans.filter((a) => !a.verified).length;

  // Applications sorted — those needing review first
  const applications = [...artisans].sort((a, b) => {
    const aReview = !a.verified && a.manualReviewRequired ? 0 : 1;
    const bReview = !b.verified && b.manualReviewRequired ? 0 : 1;
    return aReview - bReview || b.createdAt - a.createdAt;
  });

  const filteredApplications = applications.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      (a.name || "").toLowerCase().includes(q) ||
      (a.identityVerifiedName || "").toLowerCase().includes(q) ||
      (a.trade || "").toLowerCase().includes(q) ||
      (a.artisanId || "").toLowerCase().includes(q)
    );
  });

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "applications", label: "Applications", badge: pendingApplications },
    { id: "customers", label: "Customers" },
    { id: "technicians", label: "Technicians" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Central Command</h1>
          <p className="text-gray-600 font-bold max-w-2xl">
            Manage users, oversee technician verifications, and monitor platform health.
          </p>
        </div>
        <Link
          href="/admin/verification"
          className="flex items-center gap-3 bg-[#FF4D4D] hover:bg-[#ff3333] text-white px-6 py-4 border-4 border-black font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          <ShieldCheck className="w-6 h-6" />
          Review Queue ({pendingVerification})
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b-4 border-black pb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
            className={`relative px-6 py-3 border-4 border-black font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-[#CCFF00] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]"
                : "bg-white hover:bg-gray-100"
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="bg-[#FF4D4D] text-white text-xs font-black px-2 py-0.5 border-2 border-black min-w-[22px] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW ──────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#E5F0FF] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-start mb-4">
              <Users className="w-10 h-10 text-blue-600" />
              <span className="bg-white border-2 border-black px-2 py-1 font-black text-sm">TOTAL</span>
            </div>
            <div className="text-5xl font-black mb-1">{customers.length}</div>
            <div className="font-bold uppercase tracking-widest text-sm text-gray-600">Registered Customers</div>
          </div>

          <div className="bg-[#FFE5F0] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-start mb-4">
              <Wrench className="w-10 h-10 text-pink-600" />
              <span className="bg-white border-2 border-black px-2 py-1 font-black text-sm">TOTAL</span>
            </div>
            <div className="text-5xl font-black mb-1">{artisans.length}</div>
            <div className="font-bold uppercase tracking-widest text-sm text-gray-600">Registered Technicians</div>
          </div>

          <div className="bg-[#E5FFE5] border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-start mb-4">
              <BadgeCheck className="w-10 h-10 text-emerald-600" />
              <span className="bg-white border-2 border-black px-2 py-1 font-black text-sm">ACTIVE</span>
            </div>
            <div className="text-5xl font-black mb-1">{artisans.filter((a) => a.verified).length}</div>
            <div className="font-bold uppercase tracking-widest text-sm text-gray-600">Verified Technicians</div>
          </div>
        </div>
      )}

      {/* ─── APPLICATIONS ──────────────────────────────────────────── */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          <div className="bg-white border-4 border-black p-4 flex items-center gap-3">
            <Search className="w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, trade, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full focus:outline-none font-bold text-lg"
            />
          </div>

          {filteredApplications.length === 0 && (
            <div className="text-center py-16 font-black uppercase tracking-widest text-gray-400">
              No applications found.
            </div>
          )}

          <div className="space-y-4">
            {filteredApplications.map((artisan) => {
              const kycStatus = artisan.identityVerificationStatus;
              const needsDiditReview = kycStatus && kycStatus !== "verified" && kycStatus !== "failed";
              const completedSteps = getSteps(artisan).filter((s) => s.done).length;

              return (
                <div
                  key={artisan.artisanId}
                  className={`bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${
                    artisan.verified ? "border-opacity-50" : ""
                  }`}
                >
                  {/* Top bar */}
                  <div
                    className={`flex items-center justify-between px-5 py-2 border-b-4 border-black text-xs font-black uppercase tracking-widest ${
                      artisan.verified
                        ? "bg-[#CCFF00]"
                        : artisan.manualReviewRequired
                        ? "bg-[#FF4D4D] text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    <span>
                      {artisan.verified
                        ? "✅ Approved"
                        : artisan.manualReviewRequired
                        ? "⚠️ Awaiting Review"
                        : "Pending"}
                    </span>
                    <span className="opacity-70">
                      Applied {new Date(artisan.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
                    {/* Left: info */}
                    <div>
                      {/* Name & ID */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-black text-xl leading-tight">
                          {artisan.identityVerifiedName || artisan.name || "Name not verified"}
                        </h3>
                        <span className="text-xs font-mono text-gray-400 mt-1 shrink-0">
                          {artisan.artisanId.substring(0, 10)}...
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <KycChip artisan={artisan} />
                        {artisan.trade && (
                          <span className="px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-black bg-gray-100">
                            {artisan.trade}
                          </span>
                        )}
                        {artisan.neighborhood && (
                          <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                            <MapPin className="w-3 h-3" /> {artisan.neighborhood}
                          </span>
                        )}
                      </div>

                      {/* KYC detail */}
                      {kycStatus === "verified" && artisan.identityVerifiedName && (
                        <div className="bg-[#E5FFE5] border-2 border-black px-3 py-2 text-xs font-bold mb-3 inline-block">
                          ID verified as: <span className="font-black">{artisan.identityVerifiedName}</span>
                          {artisan.identityVerifiedDOB && (
                            <span className="ml-2 text-gray-500">DOB: {artisan.identityVerifiedDOB}</span>
                          )}
                        </div>
                      )}

                      {kycStatus === "failed" && (
                        <div className="bg-red-50 border-2 border-red-400 px-3 py-2 text-xs font-bold text-red-700 mb-3 inline-block">
                          KYC failed — identity could not be verified via Didit.
                        </div>
                      )}

                      {needsDiditReview && (
                        <div className="bg-amber-50 border-2 border-amber-400 px-3 py-2 text-xs font-bold text-amber-800 mb-3">
                          <p className="mb-1 font-black">⚠️ This account needs Didit review.</p>
                          <p>
                            Search for <span className="font-black">"{artisan.identityVerifiedName || artisan.name}"</span>
                            {artisan.identityVerificationReference && (
                              <span> (ref: <span className="font-mono">{artisan.identityVerificationReference}</span>)</span>
                            )}
                            {" "}on{" "}
                            <a
                              href="https://business.didit.me"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-black inline-flex items-center gap-1"
                            >
                              business.didit.me <ExternalLink className="w-3 h-3" />
                            </a>
                          </p>
                        </div>
                      )}

                      {/* Document status */}
                      <div className="flex flex-wrap gap-3 text-xs font-bold mb-3">
                        <span className={`flex items-center gap-1 ${artisan.certificateUrl ? "text-emerald-700" : "text-gray-400"}`}>
                          {artisan.certificateUrl ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Certificate
                        </span>
                        <span className={`flex items-center gap-1 ${artisan.policeClearanceUrl ? "text-emerald-700" : "text-gray-400"}`}>
                          {artisan.policeClearanceUrl ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Police Clearance
                        </span>
                        <span className={`flex items-center gap-1 ${(artisan.portfolioPhotoUrls?.length ?? 0) > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                          {(artisan.portfolioPhotoUrls?.length ?? 0) > 0 ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Portfolio ({artisan.portfolioPhotoUrls?.length ?? 0} photos)
                        </span>
                      </div>

                      {/* Step progress bar */}
                      <div>
                        <p className="text-xs font-black uppercase text-gray-500 mb-1">
                          Onboarding: {completedSteps}/6 steps complete
                        </p>
                        <StepBar artisan={artisan} />
                      </div>

                      {/* Manual review reasons */}
                      {artisan.manualReviewReasons && artisan.manualReviewReasons.length > 0 && !artisan.verified && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {artisan.manualReviewReasons.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 text-xs font-bold border-2 border-amber-500 bg-amber-50 text-amber-800 uppercase"
                            >
                              {r.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col gap-3 min-w-[180px]">
                      {artisan.verified ? (
                        <button
                          onClick={() => handleVerify(artisan.artisanId, false)}
                          disabled={actionLoading === artisan.artisanId}
                          className="w-full bg-white text-black font-black uppercase tracking-wider py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 text-sm"
                        >
                          {actionLoading === artisan.artisanId ? "Revoking..." : "Revoke"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(artisan.artisanId, true)}
                          disabled={actionLoading === artisan.artisanId}
                          className="w-full bg-[#CCFF00] text-black font-black uppercase tracking-wider py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 text-sm"
                        >
                          {actionLoading === artisan.artisanId ? "Approving..." : "Approve"}
                        </button>
                      )}

                      <Link
                        href={`/admin/technician/${artisan.artisanId}`}
                        className="w-full text-center flex items-center justify-center gap-1 bg-black text-white font-black uppercase tracking-wider py-3 border-4 border-black hover:bg-gray-800 transition-colors text-sm"
                      >
                        Full Profile <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── CUSTOMERS ─────────────────────────────────────────────── */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          <div className="bg-white border-4 border-black p-4 flex items-center gap-3">
            <Search className="w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full focus:outline-none font-bold text-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers
              .filter(
                (c) =>
                  (c.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (c.phone || "").toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((customer) => (
                <Link
                  href={`/admin/customer/${customer.userId}`}
                  key={customer.userId}
                  className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col relative overflow-hidden hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer block"
                >
                  {customer.isAdmin && (
                    <div className="absolute top-0 right-0 bg-[#CCFF00] border-l-4 border-b-4 border-black px-3 py-1 font-black text-xs uppercase tracking-widest">
                      Admin
                    </div>
                  )}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full border-2 border-black overflow-hidden bg-gray-200">
                      <div className="w-full h-full flex items-center justify-center font-black text-xl">
                        {customer.displayName?.charAt(0) || "U"}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-black text-lg truncate w-40">{customer.displayName || "Unnamed User"}</h3>
                      <p className="text-sm font-bold text-gray-500 truncate w-40">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-4 border-t-2 border-dashed border-gray-300 text-xs font-bold uppercase flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Joined {new Date(customer.createdAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* ─── TECHNICIANS ───────────────────────────────────────────── */}
      {activeTab === "technicians" && (
        <div className="space-y-6">
          <div className="bg-white border-4 border-black p-4 flex items-center gap-3">
            <Search className="w-6 h-6 text-gray-400" />
            <input
              type="text"
              placeholder="Search technicians by name, trade, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full focus:outline-none font-bold text-lg"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {artisans
              .filter(
                (a) =>
                  (a.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (a.trade || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (a.neighborhood || "").toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((artisan) => (
                <div
                  key={artisan.artisanId}
                  className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row"
                >
                  <div className="p-6 flex-1 flex flex-col justify-between border-b-4 md:border-b-0 md:border-r-4 border-black">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-black text-xl leading-tight">{artisan.name}</h3>
                        {artisan.verified && <BadgeCheck className="w-6 h-6 text-[#CCFF00]" />}
                      </div>
                      <div className="font-bold text-gray-500 uppercase tracking-wider text-sm mb-4">
                        {artisan.services && artisan.services.length > 0
                          ? Array.from(new Set(artisan.services.map((s) => s.trade))).join(", ")
                          : artisan.trade}
                      </div>
                      <div className="space-y-2 font-semibold text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" /> {artisan.neighborhood}
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-500" />
                          {(artisan.ratingAverage ?? 0).toFixed(1)} Rating ({artisan.ratingCount ?? 0} reviews)
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold uppercase text-gray-400">
                      ID: {artisan.artisanId.substring(0, 8)}...
                    </div>
                  </div>

                  <div className="p-6 md:w-64 bg-gray-50 flex flex-col justify-center gap-4">
                    {artisan.verified ? (
                      <button
                        onClick={() => handleVerify(artisan.artisanId, false)}
                        disabled={actionLoading === artisan.artisanId}
                        className="w-full bg-white text-black font-black uppercase tracking-wider py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                      >
                        {actionLoading === artisan.artisanId ? "Revoking..." : "Revoke"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerify(artisan.artisanId, true)}
                        disabled={actionLoading === artisan.artisanId}
                        className="w-full bg-[#CCFF00] text-black font-black uppercase tracking-wider py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                      >
                        {actionLoading === artisan.artisanId ? "Verifying..." : "Verify Now"}
                      </button>
                    )}
                    <Link
                      href={`/admin/technician/${artisan.artisanId}`}
                      className="w-full text-center block bg-black text-white font-black uppercase tracking-wider py-3 border-4 border-black hover:bg-gray-800 transition-colors"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
