"use client";

import { useEffect, useState } from "react";
import { Strike } from "@/types/platform";
import StrikeAppealModal from "./StrikeAppealModal";
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Scale, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw
} from "lucide-react";

interface AccountStrikesSectionProps {
  userId: string;
  userType?: "artisan" | "customer";
  compact?: boolean;
}

export default function AccountStrikesSection({
  userId,
  userType = "customer",
  compact = false
}: AccountStrikesSectionProps) {
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrike, setSelectedStrike] = useState<Strike | null>(null);

  const fetchStrikes = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/strikes/my-strikes?userId=${userId}`);
      const data = await res.json();
      if (data.strikes) {
        setStrikes(data.strikes);
      }
    } catch (err) {
      console.error("Error fetching account strikes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrikes();
  }, [userId]);

  const activeStrikes = strikes.filter(s => s.active);
  const activeCount = activeStrikes.length;

  if (loading) {
    return (
      <div className="p-4 bg-white border-2 border-black font-mono text-xs font-bold flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Checking account standing...
      </div>
    );
  }

  // If compact banner and no active strikes, render nothing
  if (compact && activeCount === 0) {
    return null;
  }

  return (
    <div className="font-mono text-black space-y-4">
      {/* Standing Summary Card */}
      <div className={`p-4 border-4 border-black shadow-[4px_4px_0_0_#000] ${
        activeCount === 0 
          ? "bg-green-50" 
          : activeCount === 1 
          ? "bg-yellow-50" 
          : "bg-red-50"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {activeCount === 0 ? (
              <div className="p-2 bg-green-500 text-white border-2 border-black">
                <ShieldCheck className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-2 bg-red-600 text-white border-2 border-black">
                <ShieldAlert className="w-6 h-6" />
              </div>
            )}
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">
                Account Standing: {activeCount === 0 ? "Good Standing" : `${activeCount} Policy Strike${activeCount > 1 ? "s" : ""}`}
              </h3>
              <p className="text-xs font-bold text-gray-700 mt-0.5">
                {activeCount === 0
                  ? "You have zero active strikes. Your platform privileges and rankings are unrestricted."
                  : activeCount === 1
                  ? "Strike 1: First Warning issued. Maintain platform guidelines to avoid ranking penalties."
                  : activeCount === 2
                  ? userType === "artisan"
                    ? "Strike 2: Severe warning. 0.6x ranking multiplier penalty applied."
                    : "Strike 2: Final Warning issued. A third strike results in permanent ban."
                  : "Strike 3: Account Suspended & Blacklisted due to repeated circumvention."}
              </p>
            </div>
          </div>

          <button
            onClick={fetchStrikes}
            className="p-1.5 border-2 border-black hover:bg-black hover:text-white transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List of Strikes if any exist */}
      {strikes.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-600">
            Recorded Platform Strikes ({strikes.length})
          </h4>

          {strikes.map((strike) => {
            const isPending = strike.appealStatus === "pending";
            const isApproved = strike.appealStatus === "approved";
            const isRejected = strike.appealStatus === "rejected";

            return (
              <div
                key={strike.strikeId}
                className={`p-4 border-2 border-black bg-white shadow-[2px_2px_0_0_#000] space-y-2 ${
                  !strike.active ? "opacity-75 bg-gray-50" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-black uppercase border border-black ${
                      strike.active ? "bg-red-500 text-white" : "bg-gray-300 text-gray-700 line-through"
                    }`}>
                      Strike #{strike.strikeNumber} {strike.active ? "(Active)" : "(Voided)"}
                    </span>
                    <span className="text-xs font-bold text-gray-500">
                      Issued: {new Date(strike.issuedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPending && (
                      <span className="px-2 py-0.5 bg-yellow-300 text-black border border-black text-xs font-black uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Appeal Pending
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-2 py-0.5 bg-green-500 text-white border border-black text-xs font-black uppercase flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Appeal Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-2 py-0.5 bg-red-600 text-white border border-black text-xs font-black uppercase flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Appeal Rejected
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-black">Reason: {strike.reason}</p>
                  <p className="text-xs font-bold text-gray-600 mt-0.5">Evidence: {strike.evidenceSummary}</p>
                </div>

                {/* Appeal action button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedStrike(strike)}
                    className="px-3 py-1.5 bg-[var(--color-brutal-yellow,#FFD700)] text-black border-2 border-black font-black uppercase text-xs flex items-center gap-1.5 hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    {isPending ? "View Submitted Appeal" : isApproved || isRejected ? "View Appeal Decision" : "Appeal Strike"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Appeal Dialog Modal */}
      {selectedStrike && (
        <StrikeAppealModal
          strike={selectedStrike}
          currentUserId={userId}
          onClose={() => setSelectedStrike(null)}
          onAppealSubmitted={() => {
            setSelectedStrike(null);
            fetchStrikes();
          }}
        />
      )}
    </div>
  );
}
