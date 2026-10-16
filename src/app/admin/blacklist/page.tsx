"use client";

import { useEffect, useState } from "react";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  Trash2, 
  RefreshCw, 
  UserX, 
  FileText, 
  AlertTriangle, 
  Plus, 
  Eye, 
  X,
  ExternalLink,
  CheckCircle,
  Flag
} from "lucide-react";

interface BlacklistedDoc {
  id: string;
  documentNumber: string;
  documentType: string;
  userId?: string;
  bannedAt: number;
  reason: string;
  source: string;
  bannedBy?: string;
}

interface BlacklistedCustomer {
  id: string;
  key: string;
  type: "phone" | "email";
  userId?: string;
  bannedAt: number;
  reason: string;
}

interface TechnicianKycItem {
  userId: string;
  businessName: string;
  trade: string;
  verified: boolean;
  kycStatus: string;
  documentType: string;
  documentNumber: string | null;
  verifiedName: string | null;
  dob: string | null;
  nationality: string | null;
  kycSessionId: string | null;
  banned: boolean;
  deactivated: boolean;
  isBlacklisted: boolean;
}

export default function AdminBlacklistPage() {
  const [activeTab, setActiveTab] = useState<"technicians" | "documents" | "customers" | "manual">("technicians");
  const [blacklistedDocs, setBlacklistedDocs] = useState<BlacklistedDoc[]>([]);
  const [blacklistedCustomers, setBlacklistedCustomers] = useState<BlacklistedCustomer[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianKycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manual Flag Modal State
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagTarget, setFlagTarget] = useState<{ docNumber: string; docType: string; userId?: string; name?: string } | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [processingFlag, setProcessingFlag] = useState(false);

  // Didit KYC Inspection Modal State
  const [inspectTarget, setInspectTarget] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/blacklist");
      const data = await res.json();
      if (data.success) {
        setBlacklistedDocs(data.blacklistedDocuments || []);
        setBlacklistedCustomers(data.blacklistedCustomers || []);
        setTechnicians(data.techniciansWithKyc || []);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: "Failed to load blacklist & KYC data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenFlagModal = (tech: TechnicianKycItem) => {
    const docNum = tech.documentNumber || "";
    setFlagTarget({
      docNumber: docNum,
      docType: tech.documentType || "passport",
      userId: tech.userId,
      name: tech.businessName
    });
    setFlagReason("Circumvention violations / fraudulent identity documents detected.");
    setShowFlagModal(true);
  };

  const handleConfirmBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagTarget || !flagTarget.docNumber || !flagReason.trim()) return;

    setProcessingFlag(true);
    try {
      const res = await fetch("/api/admin/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "document",
          value: flagTarget.docNumber,
          documentType: flagTarget.docType,
          userId: flagTarget.userId,
          reason: flagReason.trim(),
          adminId: "admin_console"
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", text: `Document ${flagTarget.docNumber} has been permanently blacklisted.` });
        setShowFlagModal(false);
        setFlagTarget(null);
        fetchData();
      } else {
        setFeedback({ type: "error", text: data.error || "Failed to blacklist document" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Network error" });
    } finally {
      setProcessingFlag(false);
    }
  };

  const handleRemoveBlacklist = async (key: string, type: "document" | "customer") => {
    if (!window.confirm(`Are you sure you want to remove ${key} from the blacklist?`)) return;

    try {
      const res = await fetch(`/api/admin/blacklist?type=${type}&key=${encodeURIComponent(key)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", text: `Removed ${key} from blacklist.` });
        fetchData();
      } else {
        setFeedback({ type: "error", text: data.error || "Failed to remove" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Network error" });
    }
  };

  const handleInspectKyc = async (userId: string) => {
    setInspectTarget(userId);
    setInspectLoading(true);
    setInspectData(null);
    try {
      const res = await fetch(`/api/admin/kyc?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setInspectData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInspectLoading(false);
    }
  };

  // Filter technicians
  const filteredTechnicians = technicians.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      t.businessName.toLowerCase().includes(q) ||
      t.trade.toLowerCase().includes(q) ||
      (t.documentNumber && t.documentNumber.toLowerCase().includes(q)) ||
      (t.verifiedName && t.verifiedName.toLowerCase().includes(q)) ||
      t.userId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-mono text-black">
      {/* Page Header */}
      <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0_0_#000] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <UserX className="w-7 h-7 text-[var(--color-brutal-yellow,#FFD700)] bg-black p-1 border border-black" />
            Passport & Government Document Blacklist &bull; Didit KYC Desk
          </h2>
          <p className="text-sm text-gray-700 font-bold mt-1 max-w-3xl">
            Inspect verified government IDs, passports, and Didit KYC biometric records. Flag and permanently blacklist fraudulent credentials to ban circumvention accounts and prevent re-registration.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-[var(--color-brutal-yellow,#FFD700)] text-black border-2 border-black font-black uppercase text-xs flex items-center gap-2 hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {/* Global Status Message */}
      {feedback && (
        <div className={`p-4 border-4 border-black font-black text-sm uppercase flex items-center justify-between ${
          feedback.type === "success" ? "bg-green-100 text-green-950" : "bg-red-100 text-red-950"
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="p-1 hover:bg-black hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b-2 border-black pb-2">
        <button
          onClick={() => setActiveTab("technicians")}
          className={`px-4 py-2 font-black text-xs uppercase border-2 border-black transition-all ${
            activeTab === "technicians"
              ? "bg-black text-white shadow-[2px_2px_0_0_#000] -translate-y-0.5"
              : "bg-white text-black hover:bg-gray-100"
          }`}
        >
          Technicians & Didit KYC ({technicians.length})
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 font-black text-xs uppercase border-2 border-black transition-all ${
            activeTab === "documents"
              ? "bg-black text-white shadow-[2px_2px_0_0_#000] -translate-y-0.5"
              : "bg-white text-black hover:bg-gray-100"
          }`}
        >
          Blacklisted Passports & Documents ({blacklistedDocs.length})
        </button>

        <button
          onClick={() => setActiveTab("customers")}
          className={`px-4 py-2 font-black text-xs uppercase border-2 border-black transition-all ${
            activeTab === "customers"
              ? "bg-black text-white shadow-[2px_2px_0_0_#000] -translate-y-0.5"
              : "bg-white text-black hover:bg-gray-100"
          }`}
        >
          Blacklisted Customers ({blacklistedCustomers.length})
        </button>
      </div>

      {/* TAB 1: TECHNICIANS & DIDIT KYC */}
      {activeTab === "technicians" && (
        <div className="space-y-4">
          <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-500" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search technician name, trade, passport / document number, or UID..."
              className="w-full text-xs font-bold border-none focus:outline-none uppercase"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white border-4 border-black font-black uppercase tracking-wide">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-black" />
              Loading technician records...
            </div>
          ) : filteredTechnicians.length === 0 ? (
            <div className="p-8 text-center bg-white border-4 border-black font-black text-gray-500 uppercase">
              No matching technicians found.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border-4 border-black shadow-[4px_4px_0_0_#000]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black text-white border-b-2 border-black uppercase">
                    <th className="p-3 border-r border-gray-700">Technician</th>
                    <th className="p-3 border-r border-gray-700">Trade</th>
                    <th className="p-3 border-r border-gray-700">Didit KYC Status</th>
                    <th className="p-3 border-r border-gray-700">Document Type</th>
                    <th className="p-3 border-r border-gray-700">Document / Passport #</th>
                    <th className="p-3 border-r border-gray-700">Blacklist Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  {filteredTechnicians.map((tech) => (
                    <tr key={tech.userId} className="hover:bg-amber-50/50 transition-colors">
                      <td className="p-3 border-r-2 border-black font-bold">
                        <p className="font-black text-sm">{tech.businessName}</p>
                        <p className="text-[10px] text-gray-500 font-mono">UID: {tech.userId}</p>
                        {tech.verifiedName && (
                          <p className="text-[10px] text-green-800 font-bold">KYC: {tech.verifiedName}</p>
                        )}
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold uppercase">
                        {tech.trade}
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold">
                        <span className={`px-2 py-0.5 border text-[10px] uppercase font-black ${
                          tech.kycStatus === "Approved" || tech.kycStatus === "verified"
                            ? "bg-green-200 text-green-900 border-green-800"
                            : tech.kycStatus === "blacklisted" || tech.banned
                            ? "bg-red-200 text-red-900 border-red-800"
                            : "bg-yellow-200 text-yellow-900 border-yellow-800"
                        }`}>
                          {tech.kycStatus}
                        </span>
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold uppercase">
                        {tech.documentType || "N/A"}
                      </td>
                      <td className="p-3 border-r-2 border-black font-mono font-bold">
                        {tech.documentNumber ? (
                          <span className="bg-gray-100 px-1.5 py-0.5 border border-black text-black">
                            {tech.documentNumber}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">None registered</span>
                        )}
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold">
                        {tech.isBlacklisted || tech.banned ? (
                          <span className="bg-red-600 text-white px-2 py-0.5 border border-black text-[10px] uppercase font-black flex items-center gap-1 w-fit">
                            <ShieldAlert className="w-3 h-3" /> BLACKLISTED
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-900 px-2 py-0.5 border border-green-800 text-[10px] uppercase font-black flex items-center gap-1 w-fit">
                            <ShieldCheck className="w-3 h-3" /> CLEAN
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleInspectKyc(tech.userId)}
                          className="px-2.5 py-1 bg-white border-2 border-black text-black font-black uppercase text-[10px] hover:bg-black hover:text-white transition-all shadow-[1px_1px_0_0_#000]"
                        >
                          Inspect KYC
                        </button>
                        
                        {!tech.isBlacklisted && tech.documentNumber && (
                          <button
                            onClick={() => handleOpenFlagModal(tech)}
                            className="px-2.5 py-1 bg-red-600 border-2 border-black text-white font-black uppercase text-[10px] hover:bg-black transition-all shadow-[1px_1px_0_0_#000]"
                          >
                            Flag / Blacklist
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BLACKLISTED DOCUMENTS REGISTRY */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-bold text-gray-600 uppercase">
              Permanently blacklisted passports and government documents ({blacklistedDocs.length} total)
            </p>
          </div>

          {blacklistedDocs.length === 0 ? (
            <div className="p-12 text-center bg-white border-4 border-black font-black text-gray-500 uppercase">
              No blacklisted passports or documents on record.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border-4 border-black shadow-[4px_4px_0_0_#000]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black text-white border-b-2 border-black uppercase">
                    <th className="p-3 border-r border-gray-700">Document #</th>
                    <th className="p-3 border-r border-gray-700">Document Type</th>
                    <th className="p-3 border-r border-gray-700">Associated User</th>
                    <th className="p-3 border-r border-gray-700">Blacklist Reason</th>
                    <th className="p-3 border-r border-gray-700">Date Blacklisted</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  {blacklistedDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-red-50/40 transition-colors">
                      <td className="p-3 border-r-2 border-black font-mono font-black text-sm text-red-900">
                        {doc.documentNumber || doc.id}
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold uppercase">
                        {doc.documentType || "passport"}
                      </td>
                      <td className="p-3 border-r-2 border-black font-mono text-[11px]">
                        {doc.userId || "N/A"}
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold text-gray-800">
                        {doc.reason}
                      </td>
                      <td className="p-3 border-r-2 border-black font-mono text-[11px]">
                        {doc.bannedAt ? new Date(doc.bannedAt).toLocaleString() : "N/A"}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRemoveBlacklist(doc.id, "document")}
                          className="px-3 py-1 bg-white border-2 border-black text-black font-black uppercase text-[10px] hover:bg-green-600 hover:text-white transition-all shadow-[1px_1px_0_0_#000]"
                        >
                          Pardon / Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BLACKLISTED CUSTOMERS */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          <p className="text-xs font-bold text-gray-600 uppercase">
            Permanently blacklisted customer phone numbers and emails ({blacklistedCustomers.length} total)
          </p>

          {blacklistedCustomers.length === 0 ? (
            <div className="p-12 text-center bg-white border-4 border-black font-black text-gray-500 uppercase">
              No blacklisted customer contacts on record.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border-4 border-black shadow-[4px_4px_0_0_#000]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black text-white border-b-2 border-black uppercase">
                    <th className="p-3 border-r border-gray-700">Phone / Email</th>
                    <th className="p-3 border-r border-gray-700">Contact Type</th>
                    <th className="p-3 border-r border-gray-700">Reason</th>
                    <th className="p-3 border-r border-gray-700">Date Blacklisted</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  {blacklistedCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-red-50/40 transition-colors">
                      <td className="p-3 border-r-2 border-black font-mono font-black text-sm">
                        {cust.key || cust.id}
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold uppercase">
                        {cust.type || "phone"}
                      </td>
                      <td className="p-3 border-r-2 border-black font-bold text-gray-800">
                        {cust.reason}
                      </td>
                      <td className="p-3 border-r-2 border-black font-mono text-[11px]">
                        {cust.bannedAt ? new Date(cust.bannedAt).toLocaleString() : "N/A"}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRemoveBlacklist(cust.id, "customer")}
                          className="px-3 py-1 bg-white border-2 border-black text-black font-black uppercase text-[10px] hover:bg-green-600 hover:text-white transition-all shadow-[1px_1px_0_0_#000]"
                        >
                          Pardon / Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FLAG & BLACKLIST MODAL */}
      {showFlagModal && flagTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-lg w-full shadow-[8px_8px_0_0_#000] relative">
            <button 
              onClick={() => setShowFlagModal(false)}
              className="absolute top-4 right-4 text-black hover:text-red-600"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>

            <h3 className="text-xl font-black uppercase text-red-600 mb-2 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" /> Flag & Blacklist Document
            </h3>

            <p className="text-xs font-bold text-gray-700 uppercase mb-4">
              Permanently bans technician <span className="underline font-black">{flagTarget.name}</span> and blacklists their government document from all future use on NEED.
            </p>

            <form onSubmit={handleConfirmBlacklist} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">Document / Passport Number</label>
                <input 
                  type="text"
                  value={flagTarget.docNumber}
                  onChange={(e) => setFlagTarget({ ...flagTarget, docNumber: e.target.value })}
                  className="w-full p-2.5 border-2 border-black font-mono font-bold text-sm bg-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">Document Type</label>
                <select 
                  value={flagTarget.docType}
                  onChange={(e) => setFlagTarget({ ...flagTarget, docType: e.target.value })}
                  className="w-full p-2.5 border-2 border-black font-bold text-xs"
                >
                  <option value="passport">International Passport</option>
                  <option value="driving_licence">Driver's License</option>
                  <option value="national_id">National ID Card</option>
                  <option value="government_document">Government Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">Blacklist Reason</label>
                <textarea 
                  rows={3}
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full p-2.5 border-2 border-black font-bold text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={processingFlag}
                  className="flex-1 py-3 bg-red-600 text-white font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0_0_#000] hover:bg-black transition-all disabled:opacity-50"
                >
                  {processingFlag ? "Blacklisting..." : "Confirm & Blacklist Document"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFlagModal(false)}
                  className="px-4 py-3 bg-white text-black font-black uppercase text-xs border-2 border-black"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIDIT KYC INSPECTION MODAL */}
      {inspectTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_0_#000] relative">
            <button 
              onClick={() => setInspectTarget(null)}
              className="absolute top-4 right-4 text-black hover:text-red-600"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>

            <h3 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-[var(--color-brutal-yellow,#FFD700)] bg-black p-1 border border-black" />
              Didit KYC Identity Audit
            </h3>

            {inspectLoading ? (
              <div className="p-8 text-center font-bold uppercase">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-black" />
                Querying Didit verification records...
              </div>
            ) : inspectData ? (
              <div className="space-y-4 text-xs font-bold">
                {/* Status banner */}
                <div className={`p-3 border-2 border-black flex justify-between items-center ${
                  inspectData.blacklist?.isBlacklisted ? "bg-red-200 text-red-950" : "bg-green-200 text-green-950"
                }`}>
                  <span className="font-black uppercase">
                    Status: {inspectData.blacklist?.isBlacklisted ? "PERMANENTLY BLACKLISTED" : "VERIFIED & VALID"}
                  </span>
                  <span className="font-mono text-[10px]">
                    Session: {inspectData.sessionId || "N/A"}
                  </span>
                </div>

                {/* Artisan KYC Summary */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 border-2 border-black">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Artisan Name</span>
                    <span className="font-black text-sm">{inspectData.artisan?.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Verified Full Name</span>
                    <span className="font-black text-sm">{inspectData.artisan?.verifiedName || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Document Type</span>
                    <span className="font-black uppercase">{inspectData.artisan?.documentType || "Passport"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Document / Passport Number</span>
                    <span className="font-black font-mono text-sm bg-yellow-200 px-1 border border-black inline-block">
                      {inspectData.artisan?.documentNumber || "Not Provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Liveness Score</span>
                    <span className="font-black">{inspectData.artisan?.livenessScore ? `${(inspectData.artisan.livenessScore * 100).toFixed(1)}%` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Face Match Score</span>
                    <span className="font-black">{inspectData.artisan?.faceMatchScore ? `${(inspectData.artisan.faceMatchScore * 100).toFixed(1)}%` : "N/A"}</span>
                  </div>
                </div>

                {/* Didit Decision raw payload snippet if available */}
                {inspectData.diditDecision && (
                  <div className="bg-black text-green-400 p-3 border-2 border-black font-mono text-[11px] max-h-48 overflow-y-auto">
                    <p className="font-black uppercase text-white mb-1 border-b border-gray-700 pb-1">Didit API Payload Decision</p>
                    <pre>{JSON.stringify(inspectData.diditDecision, null, 2)}</pre>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {!inspectData.blacklist?.isBlacklisted && inspectData.artisan?.documentNumber && (
                    <button
                      onClick={() => {
                        setInspectTarget(null);
                        setFlagTarget({
                          docNumber: inspectData.artisan.documentNumber,
                          docType: inspectData.artisan.documentType || "passport",
                          userId: inspectData.userId,
                          name: inspectData.artisan.name
                        });
                        setFlagReason("Didit KYC biometric or circumvention violation");
                        setShowFlagModal(true);
                      }}
                      className="flex-1 py-2.5 bg-red-600 text-white font-black uppercase text-xs border-2 border-black hover:bg-black transition-all"
                    >
                      Flag & Blacklist This Document
                    </button>
                  )}
                  <button
                    onClick={() => setInspectTarget(null)}
                    className="px-4 py-2.5 bg-white border-2 border-black font-black uppercase text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No KYC data found for this technician.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
