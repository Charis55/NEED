"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/utils/adminClient";
import { Settings, Save, CheckCircle, AlertTriangle } from "lucide-react";

export default function AdminConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/admin/config");
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Config fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setStatusMsg(null);
      const res = await adminFetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: config,
          adminId: "admin_user",
          note: note || "Config tuned via Admin console"
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Config successfully updated to Version ${data.config.version}`);
        setConfig(data.config);
        setNote("");
      } else {
        setStatusMsg(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border-4 border-black font-black uppercase">Loading configuration...</div>;
  }

  return (
    <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-xl font-black uppercase flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Platform Config & Anti-Leakage Parameters (Version {config?.version || 1})
          </h2>
          <p className="text-xs text-gray-600 font-bold mt-1">
            Tunable thresholds, commission rates, and deposit settings. Changes create a versioned snapshot with an audit log.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-yellow-50 border-2 border-black text-xs font-bold text-yellow-900">
          {statusMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-bold">
          {/* Deposit Percent */}
          <div className="space-y-1">
            <label className="uppercase text-gray-700">Deposit Percentage (%)</label>
            <input
              type="number"
              value={config.depositPercent}
              onChange={(e) => setConfig({ ...config, depositPercent: Number(e.target.value) })}
              className="w-full p-2 border-2 border-black"
            />
            <span className="text-[10px] text-gray-500">Portion of job price collected upfront to guarantee commission.</span>
          </div>

          {/* Deposit Minimum (in Kobo) */}
          <div className="space-y-1">
            <label className="uppercase text-gray-700">Minimum Deposit (Kobo: 100,000 = ₦1,000)</label>
            <input
              type="number"
              value={config.depositMinimum}
              onChange={(e) => setConfig({ ...config, depositMinimum: Number(e.target.value) })}
              className="w-full p-2 border-2 border-black"
            />
          </div>

          {/* Wallet Credit Limit (in Kobo) */}
          <div className="space-y-1">
            <label className="uppercase text-gray-700">Wallet Credit Limit (Kobo: 300,000 = ₦3,000)</label>
            <input
              type="number"
              value={config.walletCreditLimit}
              onChange={(e) => setConfig({ ...config, walletCreditLimit: Number(e.target.value) })}
              className="w-full p-2 border-2 border-black"
            />
            <span className="text-[10px] text-gray-500">Maximum commission debt an artisan can accumulate before job block.</span>
          </div>

          {/* Overdue Commission Days */}
          <div className="space-y-1">
            <label className="uppercase text-gray-700">Overdue Commission Recovery Window (Days)</label>
            <input
              type="number"
              value={config.overdueCommissionDays}
              onChange={(e) => setConfig({ ...config, overdueCommissionDays: Number(e.target.value) })}
              className="w-full p-2 border-2 border-black"
            />
            <span className="text-[10px] text-gray-500">Days before negative commission balance triggers automatic job request block.</span>
          </div>

          {/* Auto Confirm Hours */}
          <div className="space-y-1">
            <label className="uppercase text-gray-700">Auto Confirm Window (Hours)</label>
            <input
              type="number"
              value={config.autoConfirmHours}
              onChange={(e) => setConfig({ ...config, autoConfirmHours: Number(e.target.value) })}
              className="w-full p-2 border-2 border-black"
            />
          </div>

          {/* Escrow Enabled Toggle */}
          <div className="space-y-1">
            <label className="uppercase text-gray-700">Escrow Holding Feature Flag</label>
            <select
              value={config.escrowEnabled ? "true" : "false"}
              onChange={(e) => setConfig({ ...config, escrowEnabled: e.target.value === "true" })}
              className="w-full p-2 border-2 border-black"
            >
              <option value="false">Disabled (Immediate release to artisan minus fee)</option>
              <option value="true">Enabled (Hold custodial balance until customer confirm)</option>
            </select>
            <span className="text-[10px] text-red-600 font-black">Warning: Holding funds requires CBN / Nigerian legal sign-off.</span>
          </div>
        </div>

        {/* Audit Note & Submit */}
        <div className="pt-4 border-t-2 border-black space-y-3">
          <input
            type="text"
            placeholder="Audit log reason for change (e.g. 'Tuning deposit rate for pilot')..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-2 border-2 border-black text-xs font-bold"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-black text-white font-black text-xs uppercase flex items-center gap-2 border-2 border-black hover:bg-[var(--color-brutal-yellow,#FFD700)] hover:text-black transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving Config..." : "Save Config Snapshot (Version Bump)"}
          </button>
        </div>
      </form>
    </div>
  );
}
