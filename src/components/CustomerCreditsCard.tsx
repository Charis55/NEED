"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/utils/apiBase";
import { CustomerCredit } from "@/types/platform";
import { 
  Gift, 
  Coins, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  ArrowRight, 
  ShieldCheck,
  Tag
} from "lucide-react";

interface CustomerCreditsCardProps {
  customerId?: string;
  compact?: boolean;
}

export default function CustomerCreditsCard({
  customerId,
  compact = false
}: CustomerCreditsCardProps) {
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [usedCredits, setUsedCredits] = useState<CustomerCredit[]>([]);
  const [availableBalanceKobo, setAvailableBalanceKobo] = useState(0);
  const [lifetimeEarnedKobo, setLifetimeEarnedKobo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const fetchCredits = async () => {
    const targetId = customerId || auth.currentUser?.uid;
    if (!targetId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch(`/api/credits/my-credits?customerId=${targetId}`);
      const data = await res.json();
      if (data.success) {
        setAvailableBalanceKobo(data.availableBalanceKobo || 0);
        setLifetimeEarnedKobo(data.lifetimeEarnedKobo || 0);
        setCredits(data.availableCredits || []);
        setUsedCredits(data.usedCredits || []);
      }
    } catch (err) {
      console.error("Error fetching customer credits:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [customerId]);

  const balanceNaira = Math.round(availableBalanceKobo / 100);
  const lifetimeNaira = Math.round(lifetimeEarnedKobo / 100);

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "in_app_payment_bonus":
        return "In-App Payment Reward";
      case "survey_completion":
        return "Survey Completion Bonus";
      case "goodwill":
        return "Platform Goodwill Credit";
      default:
        return "Reward Credit";
    }
  };

  if (loading) {
    return (
      <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="font-black text-sm uppercase tracking-wide">Loading Reward Credits...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 stroke-[2.5]" />
            <span className="font-black uppercase text-xs tracking-wider">Your NEED Credits</span>
          </div>
          <span className="bg-black text-white px-2 py-0.5 font-black text-sm border-2 border-black">
            ₦{balanceNaira.toLocaleString()}
          </span>
        </div>
        <p className="text-xs font-bold mt-2 text-black/80">
          {balanceNaira > 0 
            ? `₦${balanceNaira} will be automatically offered as a discount during checkout!`
            : "Pay in-app on your next job to earn ₦300 in credit!"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b-4 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[var(--color-brutal-green)] border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <Coins className="w-7 h-7 stroke-[3] text-black" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase text-black tracking-tight flex items-center gap-2">
              DISCOUNTS & REWARDS
              <Sparkles className="w-5 h-5 text-[var(--color-brutal-yellow)] fill-[var(--color-brutal-yellow)]" />
            </h2>
            <p className="text-xs md:text-sm font-bold text-gray-600 uppercase">
              Earn credits when you pay in-app and take post-job surveys
            </p>
          </div>
        </div>

        <button
          onClick={fetchCredits}
          className="p-2 border-2 border-black bg-white hover:bg-[var(--color-brutal-yellow)] active:translate-y-0.5 transition-all"
          title="Refresh Balance"
        >
          <RefreshCw className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Main Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--color-brutal-yellow)] border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-black/70">Available Credit Balance</span>
            <span className="bg-[var(--color-brutal-green)] text-black text-[10px] font-black uppercase px-2 py-0.5 border-2 border-black">
              Ready for Checkout
            </span>
          </div>
          <div className="text-4xl md:text-5xl font-black text-black tracking-tighter">
            ₦{balanceNaira.toLocaleString()}
          </div>
          <p className="text-xs font-bold text-black mt-2">
            {balanceNaira > 0 
              ? "Applies directly to reduce your deposit when booking an artisan."
              : "No active balance yet. Complete your first booking in-app to start earning!"}
          </p>
        </div>

        <div className="bg-[var(--color-brutal-pink)] border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-black/70 mb-2">Lifetime Rewards Earned</div>
            <div className="text-3xl font-black text-black tracking-tighter">
              ₦{lifetimeNaira.toLocaleString()}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-black uppercase bg-white border-2 border-black p-2">
            <Tag className="w-4 h-4 stroke-[2.5] text-black shrink-0" />
            <span>Instant savings on future bookings</span>
          </div>
        </div>
      </div>

      {/* How to Earn Banner */}
      <div className="bg-[var(--color-brutal-teal)] border-4 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 stroke-[2.5] text-black" />
          <h3 className="font-black uppercase text-sm tracking-tight text-black">
            How to Earn & Use NEED Loyalty Credits
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="bg-white border-2 border-black p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs uppercase text-black">Pay In-App</span>
              <span className="bg-[var(--color-brutal-green)] text-black font-black text-xs px-1.5 py-0.5 border border-black">+₦300</span>
            </div>
            <p className="text-xs font-bold text-gray-700">
              Pay your booking deposit securely through NEED instead of paying cash directly to the technician.
            </p>
          </div>

          <div className="bg-white border-2 border-black p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs uppercase text-black">Answer Feedback Surveys</span>
              <span className="bg-[var(--color-brutal-green)] text-black font-black text-xs px-1.5 py-0.5 border border-black">+₦100</span>
            </div>
            <p className="text-xs font-bold text-gray-700">
              Answer the short 1-minute quality survey after an technician arrives or finishes the job.
            </p>
          </div>
        </div>

        <div className="bg-black text-white p-3 border-2 border-black flex items-center gap-3 text-xs font-black uppercase">
          <ShieldCheck className="w-5 h-5 text-[var(--color-brutal-green)] shrink-0" />
          <span>Credits automatically deduct from your deposit at checkout. No promo codes needed!</span>
        </div>
      </div>

      {/* Credit History Toggle & List */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black uppercase text-black">Credit Breakdown & History</h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs font-black uppercase text-black underline hover:text-gray-600"
          >
            {showHistory ? "Hide Breakdown" : `View Breakdown (${credits.length + usedCredits.length} items)`}
          </button>
        </div>

        {showHistory && (
          <div className="border-4 border-black divide-y-2 divide-black bg-white">
            {credits.length === 0 && usedCredits.length === 0 ? (
              <div className="p-6 text-center text-xs font-black uppercase text-gray-500">
                No credit activity yet.
              </div>
            ) : (
              <>
                {/* Available Credits */}
                {credits.map((cred) => (
                  <div key={cred.creditId} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--color-brutal-green)] text-black text-[10px] font-black uppercase px-1.5 py-0.2 border border-black">
                          Available
                        </span>
                        <span className="font-black text-sm text-black">{getReasonLabel(cred.reason)}</span>
                      </div>
                      <div className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(cred.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    <div className="font-black text-base text-[var(--color-brutal-green)] border-2 border-black bg-black px-2 py-0.5">
                      +₦{Math.round(cred.amount / 100).toLocaleString()}
                    </div>
                  </div>
                ))}

                {/* Used Credits */}
                {usedCredits.map((cred) => (
                  <div key={cred.creditId} className="p-3.5 flex items-center justify-between bg-gray-50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-200 text-gray-700 text-[10px] font-black uppercase px-1.5 py-0.2 border border-black">
                          Redeemed
                        </span>
                        <span className="font-black text-sm text-gray-700">{getReasonLabel(cred.reason)}</span>
                      </div>
                      <div className="text-[11px] font-bold text-gray-500">
                        {cred.usedJobId ? `Applied to Job #${cred.usedJobId.slice(0, 8)}` : "Redeemed at checkout"}
                        {cred.usedAt && ` • ${new Date(cred.usedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </div>
                    </div>
                    <div className="font-bold text-sm text-gray-600 line-through">
                      ₦{Math.round(cred.amount / 100).toLocaleString()}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
