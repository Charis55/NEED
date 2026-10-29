"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { adminFetch } from "@/utils/adminClient";
import {
  DollarSign,
  Search,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Scale,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { LedgerDiscrepancy, ReconciliationReport } from "@/types/platform";

export default function AdminLedgerPage() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [reports, setReports] = useState<ReconciliationReport[]>([]);
  const [discrepancies, setDiscrepancies] = useState<LedgerDiscrepancy[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Reconciliation Run State
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);

  // Discrepancy Resolution Modal State
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<LedgerDiscrepancy | null>(null);
  const [newStatus, setNewStatus] = useState<"investigating" | "resolved" | "dismissed">("investigating");
  const [resolutionNote, setResolutionNote] = useState("");
  const [updatingDiscrepancy, setUpdatingDiscrepancy] = useState(false);
  const [modalError, setModalError] = useState("");

  // Tab filter for discrepancies
  const [discrepancyFilter, setDiscrepancyFilter] = useState<"all" | "open" | "investigating" | "resolved" | "dismissed">("all");

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch negative debt wallets
      const walletsSnap = await getDocs(collection(db, "wallets"));
      const allWallets = walletsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const debts = allWallets.filter((w: any) => (w.balance || 0) < 0);
      setWallets(debts);

      // 2. Fetch recent transactions
      const txSnap = await getDocs(
        query(collection(db, "walletTransactions"), orderBy("createdAt", "desc"), limit(50))
      );
      setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 3. Fetch recent reconciliation reports
      try {
        const reportSnap = await getDocs(
          query(collection(db, "reconciliationReports"), orderBy("timestamp", "desc"), limit(5))
        );
        setReports(reportSnap.docs.map((d) => d.data() as ReconciliationReport));
      } catch (err) {
        console.warn("Could not fetch reconciliation reports:", err);
      }

      // 4. Fetch discrepancies
      try {
        const discSnap = await getDocs(
          query(collection(db, "adminDiscrepancies"), orderBy("createdAt", "desc"), limit(50))
        );
        setDiscrepancies(discSnap.docs.map((d) => d.data() as LedgerDiscrepancy));
      } catch (err) {
        console.warn("Could not fetch discrepancies:", err);
      }
    } catch (err) {
      console.error("Ledger fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunManualAudit = async () => {
    try {
      setRunningAudit(true);
      setAuditMessage(null);

      const res = await adminFetch("/api/cron/reconcile-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to run reconciliation audit");
      }

      setAuditMessage(
        `Audit completed! Audited ${data.report?.walletsChecked ?? 0} wallets. ${data.discrepanciesCount ?? 0} discrepancies recorded.`
      );
      await fetchData();
    } catch (err: any) {
      setAuditMessage(`Error: ${err.message}`);
    } finally {
      setRunningAudit(false);
    }
  };

  const handleUpdateDiscrepancy = async () => {
    if (!selectedDiscrepancy) return;
    if (resolutionNote.trim().length < 5) {
      setModalError("Please provide a note of at least 5 characters explaining your decision.");
      return;
    }

    try {
      setUpdatingDiscrepancy(true);
      setModalError("");

      const adminId = auth.currentUser?.uid || "admin_manual";

      const res = await adminFetch("/api/admin/ledger/discrepancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discrepancyId: selectedDiscrepancy.discrepancyId,
          adminId,
          status: newStatus,
          resolutionNote: resolutionNote.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update discrepancy status");
      }

      setSelectedDiscrepancy(null);
      setResolutionNote("");
      await fetchData();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setUpdatingDiscrepancy(false);
    }
  };

  const latestReport = reports[0];
  const activeDiscrepancies = discrepancies.filter((d) => d.status === "open" || d.status === "investigating");

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (discrepancyFilter === "all") return true;
    return d.status === discrepancyFilter;
  });

  const filteredTransactions = transactions.filter(
    (tx) =>
      searchTerm === "" ||
      (tx.reference && tx.reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.userId && tx.userId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.type && tx.type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* 1. Reconciliation Health & Reserve Audit Section */}
      <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase flex items-center gap-2">
              <Scale className="w-5 h-5 text-black" />
              Automated Ledger Reconciliation & Bank Reserve Audit
            </h2>
            <p className="text-xs text-gray-600 font-bold">
              Nightly audit verifies that Wallet Balance == &Sigma;(Transactions), and Held Escrows &le; Paystack settlement reserves.
            </p>
          </div>

          <button
            onClick={handleRunManualAudit}
            disabled={runningAudit}
            className="px-4 py-2 bg-[var(--color-brutal-yellow,#FFD700)] text-black border-2 border-black font-black uppercase text-xs flex items-center gap-2 hover:bg-yellow-400 active:translate-y-0.5 shadow-[2px_2px_0_0_#000] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningAudit ? "animate-spin" : ""}`} />
            {runningAudit ? "Auditing Ledgers..." : "Run Audit Now"}
          </button>
        </div>

        {auditMessage && (
          <div
            className={`p-3 border-2 border-black text-xs font-bold ${
              auditMessage.startsWith("Error") ? "bg-red-50 text-red-900" : "bg-green-50 text-green-900"
            }`}
          >
            {auditMessage}
          </div>
        )}

        {/* Health Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border-2 border-black p-4 bg-gray-50 space-y-1">
            <span className="text-[10px] uppercase font-black text-gray-500">Audit Status</span>
            <div className="flex items-center gap-2">
              {latestReport ? (
                latestReport.status === "clean" ? (
                  <>
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    <span className="font-black text-sm uppercase text-green-700">Balanced & Clean</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    <span className="font-black text-sm uppercase text-red-600">Discrepancy Detected</span>
                  </>
                )
              ) : (
                <span className="font-bold text-xs text-gray-500">Pending First Run</span>
              )}
            </div>
            <p className="text-[10px] text-gray-500">
              {latestReport ? `Last run: ${new Date(latestReport.timestamp).toLocaleString()}` : "Trigger manual run"}
            </p>
          </div>

          <div className="border-2 border-black p-4 bg-gray-50 space-y-1">
            <span className="text-[10px] uppercase font-black text-gray-500">Active Discrepancies</span>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${activeDiscrepancies.length > 0 ? "text-red-600" : "text-gray-400"}`} />
              <span className={`font-black text-xl ${activeDiscrepancies.length > 0 ? "text-red-600" : "text-black"}`}>
                {activeDiscrepancies.length}
              </span>
            </div>
            <p className="text-[10px] text-gray-500">Requires admin inspection</p>
          </div>

          <div className="border-2 border-black p-4 bg-gray-50 space-y-1">
            <span className="text-[10px] uppercase font-black text-gray-500">Held Escrow Commitments</span>
            <div className="font-black text-lg text-black">
              ₦{((latestReport?.totalHeldEscrowKobo || 0) / 100).toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-500">In customer deposits</p>
          </div>

          <div className="border-2 border-black p-4 bg-gray-50 space-y-1">
            <span className="text-[10px] uppercase font-black text-gray-500">Paystack Balance</span>
            <div className="font-black text-lg text-black">
              {latestReport?.paystackBalanceKobo !== null && latestReport?.paystackBalanceKobo !== undefined
                ? `₦${(latestReport.paystackBalanceKobo / 100).toLocaleString()}`
                : "Not connected / Simulated"}
            </div>
            <p className="text-[10px] text-gray-500">Liquid reserve backing escrow</p>
          </div>
        </div>
      </div>

      {/* 2. Discrepancy Queue & Invariant Alerts */}
      <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Discrepancy Queue & Invariant Alerts
            </h2>
            <p className="text-xs text-gray-600 font-bold">
              Rule: Never silently fix money. Discrepancies must be audited and marked with admin resolution notes.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {(["all", "open", "investigating", "resolved", "dismissed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDiscrepancyFilter(tab)}
                className={`px-3 py-1 text-[11px] font-black uppercase border-2 border-black transition-all ${
                  discrepancyFilter === tab
                    ? "bg-black text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredDiscrepancies.length === 0 ? (
          <div className="p-4 bg-green-50 border-2 border-black text-xs font-bold text-green-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            No ledger discrepancies recorded in this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-2 border-black">
              <thead className="bg-black text-white font-black uppercase">
                <tr>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Target / User ID</th>
                  <th className="p-3">Expected vs Actual</th>
                  <th className="p-3">Variance</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Detected At</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 border-black">
                {filteredDiscrepancies.map((d) => {
                  const targetLabel = d.userId || "Platform Escrow Reserve";
                  const expected = d.expectedBalance ?? d.totalHeldEscrow ?? 0;
                  const actual = d.actualBalance ?? d.paystackBalance ?? 0;
                  const variance = d.difference ?? 0;

                  return (
                    <tr key={d.discrepancyId} className="hover:bg-yellow-50">
                      <td className="p-3 font-bold">
                        <span
                          className={`px-2 py-0.5 uppercase text-[10px] font-black border border-black ${
                            d.severity === "critical"
                              ? "bg-red-500 text-white"
                              : d.severity === "high"
                              ? "bg-orange-400 text-black"
                              : "bg-yellow-300 text-black"
                          }`}
                        >
                          {d.severity}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold uppercase text-[11px]">{d.type.replace(/_/g, " ")}</td>
                      <td className="p-3 font-mono font-bold">{targetLabel}</td>
                      <td className="p-3 font-mono">
                        ₦{(expected / 100).toLocaleString()} vs ₦{(actual / 100).toLocaleString()}
                      </td>
                      <td className="p-3 font-black text-red-600 font-mono">
                        {variance > 0 ? "+" : ""}₦{(variance / 100).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                            d.status === "open"
                              ? "bg-red-100 text-red-900"
                              : d.status === "investigating"
                              ? "bg-blue-100 text-blue-900"
                              : "bg-green-100 text-green-900"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedDiscrepancy(d);
                            setNewStatus(d.status === "open" ? "investigating" : (d.status as any));
                            setResolutionNote(d.resolutionNote || "");
                            setModalError("");
                          }}
                          className="px-3 py-1 bg-white border-2 border-black font-black uppercase text-[10px] shadow-[2px_2px_0_0_#000] hover:bg-gray-100 active:translate-y-0.5"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discrepancy Resolution Modal */}
      {selectedDiscrepancy && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0_0_#000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="font-black text-lg uppercase flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Inspect Discrepancy
              </h3>
              <button
                onClick={() => setSelectedDiscrepancy(null)}
                className="font-black text-sm px-2 py-1 border border-black hover:bg-gray-200"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p>
                <strong className="uppercase">Type:</strong> {selectedDiscrepancy.type}
              </p>
              <p>
                <strong className="uppercase">Target:</strong>{" "}
                {selectedDiscrepancy.userId || "Platform Escrow Reserve"}
              </p>
              <p>
                <strong className="uppercase">Details:</strong> {selectedDiscrepancy.details}
              </p>
              <div className="bg-gray-100 p-2 border border-black space-y-1 font-mono">
                <div>
                  Expected: ₦
                  {(((selectedDiscrepancy.expectedBalance ?? selectedDiscrepancy.totalHeldEscrow ?? 0) / 100)).toLocaleString()}
                </div>
                <div>
                  Actual: ₦
                  {(((selectedDiscrepancy.actualBalance ?? selectedDiscrepancy.paystackBalance ?? 0) / 100)).toLocaleString()}
                </div>
                <div className="font-black text-red-600">
                  Variance: ₦{(((selectedDiscrepancy.difference ?? 0) / 100)).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-black uppercase">Update Status</label>
              <div className="flex gap-2">
                {(["investigating", "resolved", "dismissed"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setNewStatus(st)}
                    className={`flex-1 py-1.5 font-black uppercase text-xs border-2 border-black ${
                      newStatus === st ? "bg-[var(--color-brutal-yellow,#FFD700)] text-black" : "bg-white text-gray-700"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <label className="block text-xs font-black uppercase">
                Admin Audit Note <span className="text-red-600">*</span>
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Detail the manual audit, root cause, or offset entry made..."
                rows={3}
                className="w-full border-2 border-black p-2 text-xs font-mono"
              />

              {modalError && (
                <div className="p-2 bg-red-100 border border-red-500 text-red-900 text-xs font-bold">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDiscrepancy(null)}
                  className="px-4 py-2 border-2 border-black font-black uppercase text-xs hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateDiscrepancy}
                  disabled={updatingDiscrepancy}
                  className="px-4 py-2 bg-black text-white border-2 border-black font-black uppercase text-xs hover:bg-gray-800 disabled:opacity-50"
                >
                  {updatingDiscrepancy ? "Saving..." : "Save Audit Record"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Wallet Debts Section */}
      <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-4">
        <h2 className="text-xl font-black uppercase flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          Outstanding Wallet Debts (Negative Commission Balances)
        </h2>
        <p className="text-xs text-gray-600 font-bold">
          Artisans with negative balances who owe platform commission. The acceptance gate blocks new jobs if debt exceeds credit limit.
        </p>

        {wallets.length === 0 ? (
          <div className="p-4 bg-green-50 border-2 border-black text-xs font-bold text-green-900">
            No overdue wallet debts detected. All commissions settled.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-2 border-black">
              <thead className="bg-black text-white font-black uppercase">
                <tr>
                  <th className="p-3">Artisan UID</th>
                  <th className="p-3">Negative Balance</th>
                  <th className="p-3">Credit Limit</th>
                  <th className="p-3">Gate Status</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 border-black">
                {wallets.map((w) => (
                  <tr key={w.id} className="hover:bg-red-50">
                    <td className="p-3 font-bold">{w.id}</td>
                    <td className="p-3 font-black text-red-600">
                      -₦{(Math.abs(w.balance || 0) / 100).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold">₦{((w.creditLimit || 300000) / 100).toLocaleString()}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-black text-white uppercase text-[10px] font-black">
                        {w.blockedReason || "active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Append-Only Ledger Viewer */}
      <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Append-Only Ledger Transactions
            </h2>
            <p className="text-xs text-gray-600 font-bold">
              Every balance movement is keyed by a unique reference for idempotency.
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search reference or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border-2 border-black text-xs font-bold w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-2 border-black">
            <thead className="bg-black text-white font-black uppercase">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Balance After</th>
                <th className="p-3">User ID</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 border-black">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="p-3 font-black uppercase">{tx.type}</td>
                  <td className={`p-3 font-black ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount >= 0 ? "+" : "-"}₦{(Math.abs(tx.amount) / 100).toLocaleString()}
                  </td>
                  <td className="p-3 font-bold">₦{((tx.balanceAfter || 0) / 100).toLocaleString()}</td>
                  <td className="p-3 font-mono text-[11px]">{tx.userId}</td>
                  <td className="p-3 font-mono text-[11px]">{tx.reference}</td>
                  <td className="p-3 text-gray-500">{new Date(tx.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
