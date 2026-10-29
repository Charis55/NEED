"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { adminFetch } from "@/utils/adminClient";
import { ShieldAlert, AlertTriangle, Check, X, ShieldX, UserX, AlertOctagon } from "lucide-react";

export default function AdminCasesPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string>("");

  const fetchCases = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "leakageCases"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setCases(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error loading leakage cases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleAction = async (caseId: string, action: string) => {
    try {
      setActionLoading(caseId);
      const res = await adminFetch("/api/admin/cases/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          action,
          adminId: "admin_user",
          note: actionNote || `Admin executed ${action}`
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Success: Action ${action} applied.`);
        setActionNote("");
        fetchCases();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0_0_#000]">
        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-600" />
          Leakage & Circumvention Review Queue
        </h2>
        <p className="text-sm text-gray-600 font-bold mt-1">
          Review evidence bundles compiled by automated surveillance, customer surveys, and message filtering.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-white border-4 border-black font-black uppercase">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="p-8 text-center bg-white border-4 border-black font-black uppercase text-gray-500">
          No leakage cases detected. All surveillance systems clear.
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <div key={c.id} className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 text-xs font-black uppercase border-2 border-black ${
                    c.status === "open" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700"
                  }`}>
                    Status: {c.status}
                  </span>
                  <span className="font-black text-sm uppercase">Artisan UID: {c.artisanId}</span>
                </div>
                <div className="text-sm font-black bg-[var(--color-brutal-yellow,#FFD700)] px-3 py-1 border-2 border-black">
                  Risk Score: {c.score}
                </div>
              </div>

              {/* Reasons */}
              <div>
                <p className="text-xs font-black uppercase text-gray-500 mb-1">Detected Risk Factors:</p>
                <ul className="list-disc list-inside space-y-1 text-sm font-bold text-red-700">
                  {c.reasons?.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* Evidence details */}
              {c.evidence && (
                <div className="bg-gray-50 p-4 border-2 border-black text-xs font-mono space-y-1">
                  <p className="font-black uppercase text-black">Evidence Summary:</p>
                  <p className="text-gray-700">{JSON.stringify(c.evidence)}</p>
                </div>
              )}

              {/* Action Toolbar */}
              {c.status === "open" && (
                <div className="pt-2 border-t-2 border-black space-y-3">
                  <input
                    type="text"
                    placeholder="Optional enforcement note or rationale..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    className="w-full p-2 border-2 border-black text-xs font-bold"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAction(c.id, "dismiss")}
                      disabled={actionLoading === c.id}
                      className="px-3 py-1.5 bg-gray-200 text-black border-2 border-black font-black text-xs uppercase hover:bg-gray-300"
                    >
                      Dismiss Case
                    </button>
                    <button
                      onClick={() => handleAction(c.id, "warn")}
                      disabled={actionLoading === c.id}
                      className="px-3 py-1.5 bg-yellow-400 text-black border-2 border-black font-black text-xs uppercase hover:bg-yellow-500"
                    >
                      Issue Warning (Strike 1)
                    </button>
                    <button
                      onClick={() => handleAction(c.id, "strike")}
                      disabled={actionLoading === c.id}
                      className="px-3 py-1.5 bg-orange-500 text-white border-2 border-black font-black text-xs uppercase hover:bg-orange-600"
                    >
                      Apply Ranking Penalty (Strike 2)
                    </button>
                    <button
                      onClick={() => handleAction(c.id, "suspend")}
                      disabled={actionLoading === c.id}
                      className="px-3 py-1.5 bg-red-600 text-white border-2 border-black font-black text-xs uppercase hover:bg-red-700"
                    >
                      Suspend 7 Days (Strike 3)
                    </button>
                    <button
                      onClick={() => handleAction(c.id, "deactivate")}
                      disabled={actionLoading === c.id}
                      className="px-3 py-1.5 bg-black text-white border-2 border-black font-black text-xs uppercase hover:bg-gray-800"
                    >
                      Permanent Ban (Strike 4)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
