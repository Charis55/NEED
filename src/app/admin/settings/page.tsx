"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { Save, Settings as SettingsIcon } from "lucide-react";
import { useAlert } from "@/components/AlertProvider";
import GlobalSpinner from "@/components/GlobalSpinner";

export default function AdminSettingsPage() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [commissionRate, setCommissionRate] = useState<number>(20);
  const [baseFee, setBaseFee] = useState<number>(0);

  useEffect(() => {
    async function loadConfig() {
      try {
        const configDoc = await getDoc(doc(db, "platform", "config"));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.commissionRate !== undefined) setCommissionRate(data.commissionRate * 100);
          if (data.baseFee !== undefined) setBaseFee(data.baseFee);
        }
      } catch (err) {
        console.error("Error loading config:", err);
        showAlert("Failed to load platform configuration", "error");
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [showAlert]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "platform", "config"), {
        commissionRate: commissionRate / 100, // store as decimal
        baseFee: baseFee,
        updatedAt: Date.now()
      }, { merge: true });
      showAlert("Platform configuration saved successfully!", "success");
    } catch (err) {
      console.error("Error saving config:", err);
      showAlert("Failed to save platform configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <GlobalSpinner />;

  return (
    <div className="w-full min-h-screen bg-[var(--color-brutal-bg)] pb-24 font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black">
      <div className="px-6 md:px-12 pt-12 pb-6 flex justify-between items-end border-b-4 border-black bg-[var(--color-brutal-teal)]">
        <div>
          <h1 className="text-3xl md:text-5xl font-black text-black uppercase tracking-tighter leading-none mb-2">
            Platform Settings
          </h1>
          <p className="font-bold text-gray-800 uppercase text-sm md:text-base">Commission & Fee Configuration</p>
        </div>
        <Link 
          href="/admin"
          className="bg-white text-black px-6 py-2 font-black uppercase brutal-border hover:bg-[var(--color-brutal-yellow)] transition-colors"
        >
          BACK TO DASHBOARD
        </Link>
      </div>

      <div className="px-6 md:px-12 py-8 max-w-2xl mx-auto">
        <div className="bg-white brutal-border p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6 border-b-4 border-black pb-4">
            <SettingsIcon className="w-8 h-8" />
            <h2 className="text-2xl font-black uppercase">Financial Config</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block font-black uppercase mb-2">Platform Commission Rate (%)</label>
              <div className="flex">
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                  className="w-full p-4 font-bold border-4 border-black border-r-0 focus:outline-none focus:bg-[var(--color-brutal-yellow)]"
                  required
                />
                <div className="p-4 bg-black text-white font-black border-4 border-black flex items-center justify-center">
                  %
                </div>
              </div>
              <p className="text-sm font-bold text-gray-500 mt-1 uppercase">Percentage taken from technician payouts.</p>
            </div>

            <div>
              <label className="block font-black uppercase mb-2">Base Booking Fee (₦)</label>
              <div className="flex">
                <div className="p-4 bg-black text-white font-black border-4 border-black flex items-center justify-center">
                  ₦
                </div>
                <input 
                  type="number" 
                  min="0"
                  step="100"
                  value={baseFee}
                  onChange={(e) => setBaseFee(parseFloat(e.target.value) || 0)}
                  className="w-full p-4 font-bold border-4 border-black border-l-0 focus:outline-none focus:bg-[var(--color-brutal-yellow)]"
                  required
                />
              </div>
              <p className="text-sm font-bold text-gray-500 mt-1 uppercase">Fixed flat fee charged to the customer per request.</p>
            </div>

            <button 
              type="submit"
              disabled={saving}
              className="w-full bg-[var(--color-brutal-green)] text-black py-4 font-black uppercase border-4 border-black brutal-shadow-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? "SAVING..." : "SAVE CONFIGURATION"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
