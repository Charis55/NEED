"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ShieldAlert, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Activity, DollarSign } from "lucide-react";
import { adminFetch } from "@/utils/adminClient";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    totalCases: 0,
    openCases: 0,
    totalWallets: 0,
    negativeWallets: 0,
    totalNegativeDebtKobo: 0,
    totalClaims: 0,
    completedJobs: 0,
    settledCommissionKobo: 0,
  });
  const [loading, setLoading] = useState(true);
  const [cronRunning, setCronRunning] = useState(false);
  const [cronStatus, setCronStatus] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      // Fetch cases
      const casesSnap = await getDocs(collection(db, "leakageCases"));
      const totalCases = casesSnap.size;
      const openCases = casesSnap.docs.filter(d => d.data().status === "open").length;

      // Fetch wallets
      const walletsSnap = await getDocs(collection(db, "wallets"));
      let negativeWallets = 0;
      let totalNegativeDebt = 0;
      walletsSnap.forEach(doc => {
        const bal = doc.data().balance || 0;
        if (bal < 0) {
          negativeWallets++;
          totalNegativeDebt += Math.abs(bal);
        }
      });

      // Fetch guarantee claims
      const claimsSnap = await getDocs(collection(db, "guaranteeClaims"));

      // Fetch jobs
      const jobsSnap = await getDocs(collection(db, "jobRequests"));
      let completed = 0;
      let settledCommission = 0;
      jobsSnap.forEach(doc => {
        const j = doc.data();
        if (j.state === "completed") completed++;
        if (j.commissionSettled && j.platformFee) settledCommission += j.platformFee;
      });

      setMetrics({
        totalCases,
        openCases,
        totalWallets: walletsSnap.size,
        negativeWallets,
        totalNegativeDebtKobo: totalNegativeDebt,
        totalClaims: claimsSnap.size,
        completedJobs: completed,
        settledCommissionKobo: settledCommission,
      });
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const triggerCron = async () => {
    try {
      setCronRunning(true);
      setCronStatus("Running automated leakage detection & reconciliation...");
      const res = await adminFetch("/api/cron/leakage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "all" })
      });
      const data = await res.json();
      setCronStatus(`Completed: ${JSON.stringify(data.results)}`);
      fetchMetrics();
    } catch (err: any) {
      setCronStatus(`Error: ${err.message}`);
    } finally {
      setCronRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 border-4 border-black shadow-[4px_4px_0_0_#000]">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Platform Health & Leakage Overview</h2>
          <p className="text-sm text-gray-600 font-bold mt-1">Real-time metrics, risk surveillance, and commission recovery status.</p>
        </div>
        <button
          onClick={triggerCron}
          disabled={cronRunning}
          className="bg-[var(--color-brutal-yellow,#FFD700)] text-black font-black px-4 py-2 border-2 border-black flex items-center gap-2 uppercase text-xs shadow-[2px_2px_0_0_#000] hover:bg-black hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${cronRunning ? 'animate-spin' : ''}`} />
          {cronRunning ? "Running Surveillance..." : "Run Surveillance & Reconcile"}
        </button>
      </div>

      {cronStatus && (
        <div className="p-4 bg-blue-50 border-2 border-black text-xs font-bold text-blue-900">
          {cronStatus}
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-red-50 border-4 border-black p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between text-red-600 mb-2">
            <span className="text-xs font-black uppercase">Open Leakage Cases</span>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-4xl font-black text-black">{loading ? "..." : metrics.openCases}</p>
          <p className="text-xs text-gray-600 font-bold mt-2">{metrics.totalCases} total lifetime cases</p>
        </div>

        <div className="bg-yellow-50 border-4 border-black p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between text-yellow-700 mb-2">
            <span className="text-xs font-black uppercase">Artisan Wallet Debt</span>
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-black">
            {loading ? "..." : `₦${(metrics.totalNegativeDebtKobo / 100).toLocaleString()}`}
          </p>
          <p className="text-xs text-gray-600 font-bold mt-2">{metrics.negativeWallets} artisans with overdue commission</p>
        </div>

        <div className="bg-green-50 border-4 border-black p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between text-green-700 mb-2">
            <span className="text-xs font-black uppercase">Settled Commission</span>
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-3xl font-black text-black">
            {loading ? "..." : `₦${(metrics.settledCommissionKobo / 100).toLocaleString()}`}
          </p>
          <p className="text-xs text-gray-600 font-bold mt-2">{metrics.completedJobs} verified completed jobs</p>
        </div>

        <div className="bg-purple-50 border-4 border-black p-6 shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between text-purple-700 mb-2">
            <span className="text-xs font-black uppercase">Guarantee Claims</span>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <p className="text-4xl font-black text-black">{loading ? "..." : metrics.totalClaims}</p>
          <p className="text-xs text-gray-600 font-bold mt-2">Active rework & warranty requests</p>
        </div>
      </div>

      {/* Surveillance Protocols Summary */}
      <div className="bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] space-y-4">
        <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Active Anti-Circumvention Layers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
          <div className="p-4 border-2 border-black bg-gray-50 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-black uppercase text-black">1. Upfront Deposit Commission Capture</p>
              <p className="text-gray-600 mt-1">Platform fee is captured prior to technician arrival. Prevents cash evasion on site.</p>
            </div>
          </div>
          <div className="p-4 border-2 border-black bg-gray-50 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-black uppercase text-black">2. Wallet Acceptance Gate</p>
              <p className="text-gray-600 mt-1">Blocks job requests automatically if commission debt exceeds credit limit or is older than 7 days.</p>
            </div>
          </div>
          <div className="p-4 border-2 border-black bg-gray-50 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-black uppercase text-black">3. Contact Filtering & Address Gating</p>
              <p className="text-gray-600 mt-1">Nigerian phone numbers and social links are blocked in chat. Exact address hidden until deposit confirmation.</p>
            </div>
          </div>
          <div className="p-4 border-2 border-black bg-gray-50 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-black uppercase text-black">4. Geofence Arrival & After-Arrival Reviews</p>
              <p className="text-gray-600 mt-1">Tracks foreground location. Cancellations after arrival freeze deposits and trigger automated customer leakage surveys.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
