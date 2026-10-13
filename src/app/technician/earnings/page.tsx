"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { 
  ChevronLeft, 
  Calendar, 
  DollarSign, 
  ArrowUpRight, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  Filter
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAlert } from "@/components/AlertProvider";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import dynamicImport from "next/dynamic";
import WalletCard from "@/components/WalletCard";

const PaymentModal = dynamicImport(() => import("@/components/PaymentModal"), { ssr: false });

interface EarningPeriod {
  periodKey: string;
  startDate: Date;
  endDate: Date;
  jobs: JobRequest[];
  totalEarnings: number;
  commissionOwed: number;
  isPaid: boolean;
}

interface WalletTxItem {
  txId: string;
  userId: string;
  jobId: string | null;
  type: string;
  amount: number; // in kobo (+ credit, - debit)
  balanceAfter: number | null;
  reference: string;
  channel: string;
  rawChannel?: string | null;
  createdAt: number;
  payoutStatus: "pending" | "success" | "failed" | "reversed" | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

function getChannelBadge(channel?: string, type?: string) {
  const ch = (channel || "").toLowerCase();
  if (ch.includes("transfer") || ch === "bank_transfer") {
    return {
      label: "Bank Transfer",
      icon: "🏦",
      bg: "bg-[var(--color-brutal-teal)]",
      text: "text-black",
    };
  }
  if (ch.includes("ussd")) {
    return {
      label: "USSD Code (*737#, etc.)",
      icon: "📱",
      bg: "bg-[var(--color-brutal-yellow)]",
      text: "text-black",
    };
  }
  if (ch === "bank" || ch.includes("internet") || ch.includes("online bank")) {
    return {
      label: "Internet Banking",
      icon: "🌐",
      bg: "bg-purple-200",
      text: "text-purple-950",
    };
  }
  if (ch.includes("card")) {
    return {
      label: "Debit / Credit Card",
      icon: "💳",
      bg: "bg-[var(--color-brutal-blue)]",
      text: "text-black",
    };
  }
  if (ch.includes("wallet")) {
    return {
      label: "Wallet Balance",
      icon: "💼",
      bg: "bg-amber-100",
      text: "text-black",
    };
  }
  if (type === "topup") {
    return {
      label: "Card / Transfer",
      icon: "💳",
      bg: "bg-[var(--color-brutal-blue)]",
      text: "text-black",
    };
  }
  return {
    label: channel || "Direct Payment",
    icon: "💵",
    bg: "bg-gray-200",
    text: "text-black",
  };
}

const JobEarningRow = ({ job }: { job: JobRequest }) => {
  const [expanded, setExpanded] = useState(false);
  const earn = job.counterOfferAmount || job.offerAmount || 0;
  const platformFee = earn * 0.20;
  const isSettled = (job as any).commissionPaid;
  
  const completionTimestamp = job.completedAt || job.createdAt;
  const dateObj = new Date(completionTimestamp);
  const formattedDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const formattedWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);

  return (
    <div className="border-2 border-black mb-3 bg-gray-50 flex flex-col shadow-[2px_2px_0_0_#000]">
      <div 
        onClick={() => setExpanded(!expanded)} 
        className="flex justify-between items-center p-3 hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-pointer gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronUp className="w-5 h-5 stroke-[3] shrink-0" /> : <ChevronDown className="w-5 h-5 stroke-[3] shrink-0" />}
          <div className="min-w-0">
            <p className="font-bold uppercase text-sm truncate">{job.subcategory}</p>
            <div className="text-xs font-bold text-gray-600 flex flex-col items-start mt-0.5">
              <span className="flex items-center gap-1.5 flex-wrap text-black font-extrabold text-[11px] sm:text-xs">
                <span>{formattedDate}</span>
                <span className="text-gray-400 font-normal">at</span>
                <span className="bg-white px-1.5 py-0.5 border border-black font-mono shadow-[1px_1px_0_0_#000]">{formattedTime}</span>
              </span>
              <span className="text-[10px] uppercase text-gray-500 font-black mt-0.5">{formattedWeekday}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
           <span className="font-black text-lg">₦{earn.toLocaleString()}</span>
           {isSettled ? (
             <span className="text-[10px] bg-[var(--color-brutal-green)] px-2 py-0.5 font-black uppercase text-black border border-black mt-1">Settled</span>
           ) : (
             <span className="text-[10px] bg-[var(--color-brutal-red)] px-2 py-0.5 font-black uppercase text-white border border-black mt-1">Pending</span>
           )}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 border-t-2 border-dashed border-black bg-white">
          <div className="flex justify-between mb-2 text-xs">
             <span className="font-bold text-gray-600">Job Completion Time</span>
             <span className="font-black font-mono text-black">{formattedDate} at {formattedTime} ({formattedWeekday})</span>
          </div>
          <div className="flex justify-between mb-2 text-xs">
             <span className="font-bold text-gray-600">Job Reference</span>
             <span className="font-mono font-bold text-gray-800">#{job.requestId.slice(0, 10)}</span>
          </div>
          <div className="flex justify-between mb-2">
             <span className="text-sm font-bold text-gray-600">Total Earned</span>
             <span className="text-sm font-black">₦{earn.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-2">
             <span className="text-sm font-bold text-[var(--color-brutal-red)]">Platform Fee (20%)</span>
             <span className="text-sm font-black text-[var(--color-brutal-red)]">- ₦{platformFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pb-2 border-b-2 border-black">
             <span className="text-base font-black">Your Take Home</span>
             <span className="text-base font-black text-[var(--color-brutal-teal)]">₦{(earn - platformFee).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const WalletTxRow = ({ tx }: { tx: WalletTxItem }) => {
  const [expanded, setExpanded] = useState(false);
  const amountNaira = Math.abs(tx.amount) / 100;
  const isCredit = tx.amount > 0;
  const txDate = new Date(tx.createdAt);
  const dateFormatted = txDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const timeFormatted = txDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const weekdayFormatted = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(txDate);

  const channelBadge = getChannelBadge(tx.channel, tx.type);

  // Status badge config
  let statusBadge = { label: "SUCCESS", bg: "bg-[var(--color-brutal-green)]", text: "text-black" };
  if (tx.type === "withdrawal") {
    if (tx.payoutStatus === "pending") {
      statusBadge = { label: "PROCESSING", bg: "bg-[var(--color-brutal-yellow)]", text: "text-black" };
    } else if (tx.payoutStatus === "failed") {
      statusBadge = { label: "FAILED", bg: "bg-[var(--color-brutal-red)]", text: "text-white" };
    } else if (tx.payoutStatus === "reversed") {
      statusBadge = { label: "REVERSED", bg: "bg-purple-300", text: "text-black" };
    } else {
      statusBadge = { label: "PAID OUT", bg: "bg-[var(--color-brutal-teal)]", text: "text-black" };
    }
  } else if (tx.type === "commission_charge") {
    statusBadge = { label: "COMMISSION SETTLED", bg: "bg-black", text: "text-white" };
  }

  // Type title
  let typeTitle = "Wallet Activity";
  if (tx.type === "topup") typeTitle = "Account Funded";
  else if (tx.type === "withdrawal") typeTitle = "Bank Withdrawal";
  else if (tx.type === "commission_charge") typeTitle = "Platform Commission Fee";
  else if (tx.type === "deposit_release_to_artisan") typeTitle = "Job Escrow Released";
  else if (tx.type === "withdrawal_reversal") typeTitle = "Withdrawal Reversal (Refund)";

  return (
    <div className="border-4 border-black mb-3 bg-white shadow-[3px_3px_0_0_#000] flex flex-col">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 hover:bg-[var(--color-brutal-bg)] cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 border-2 border-black flex items-center justify-center shrink-0 ${
            tx.type === 'topup' ? 'bg-[var(--color-brutal-green)]' : tx.type === 'withdrawal' ? 'bg-[var(--color-brutal-teal)]' : 'bg-[var(--color-brutal-yellow)]'
          } shadow-[2px_2px_0_0_#000]`}>
            {tx.type === 'topup' ? (
              <TrendingDown className="w-6 h-6 stroke-[3] text-black" />
            ) : tx.type === 'withdrawal' ? (
              <TrendingUp className="w-6 h-6 stroke-[3] text-black" />
            ) : (
              <DollarSign className="w-6 h-6 stroke-[3] text-black" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-base uppercase tracking-tight">{typeTitle}</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-black ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
            </div>

            {/* Medium / Channel indicator */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 border border-black shadow-[1px_1px_0_0_#000] ${channelBadge.bg} ${channelBadge.text}`}>
                <span>{channelBadge.icon}</span>
                <span>{channelBadge.label}</span>
              </span>
              {tx.bankName && (
                <span className="text-[11px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 border border-gray-400">
                  {tx.bankName} {tx.accountNumber ? `••••${tx.accountNumber.slice(-4)}` : ""}
                </span>
              )}
            </div>

            {/* Date AND Time */}
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600 mt-1.5 flex-wrap">
              <span className="font-mono text-black font-extrabold">{dateFormatted}</span>
              <span className="text-gray-400">•</span>
              <span className="bg-gray-200 px-1.5 py-0.2 border border-black font-mono text-black text-[11px]">
                {timeFormatted}
              </span>
              <span className="text-[10px] uppercase text-gray-500 font-bold hidden sm:inline">({weekdayFormatted})</span>
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t-2 md:border-t-0 border-dashed border-gray-300 pt-2 md:pt-0">
          <span className={`font-black text-xl md:text-2xl tracking-tight ${isCredit ? 'text-[var(--color-brutal-green)]' : 'text-black'}`}>
            {isCredit ? `+₦${amountNaira.toLocaleString()}` : `-₦${amountNaira.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-1 text-xs font-black text-gray-500 mt-0.5">
            <span>{expanded ? "HIDE DETAILS" : "VIEW DETAILS"}</span>
            {expanded ? <ChevronUp className="w-4 h-4 stroke-[3]" /> : <ChevronDown className="w-4 h-4 stroke-[3]" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t-4 border-black bg-gray-50 text-xs font-bold space-y-2">
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span className="text-gray-600 uppercase">Exact Timestamp</span>
            <span className="font-mono font-black text-black">{dateFormatted} at {timeFormatted}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span className="text-gray-600 uppercase">Payment Medium</span>
            <span className="font-black text-black">{channelBadge.icon} {channelBadge.label}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span className="text-gray-600 uppercase">Reference Code</span>
            <span className="font-mono font-bold text-black break-all">{tx.reference}</span>
          </div>
          {tx.balanceAfter !== null && (
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600 uppercase">Wallet Balance After</span>
              <span className="font-black text-base text-[var(--color-brutal-teal)]">₦{(tx.balanceAfter / 100).toLocaleString()}</span>
            </div>
          )}
          {tx.accountName && (
            <div className="flex justify-between py-1">
              <span className="text-gray-600 uppercase">Recipient Account</span>
              <span className="font-black text-black">{tx.accountName} ({tx.bankName})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function EarningsContent() {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<EarningPeriod[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTxItem[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<EarningPeriod | null>(null);
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [txFilter, setTxFilter] = useState<"all" | "topup" | "withdrawal" | "commission">("all");

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "wallet" ? "wallet" : "jobs";
  const [activeTab, setActiveTab] = useState<"jobs" | "wallet">(initialTab);
  
  const router = useRouter();
  const { showAlert } = useAlert();

  const fetchWalletTx = async (userId: string) => {
    try {
      setLoadingTx(true);
      const res = await fetch(`/api/wallet/transactions?userId=${userId}`);
      const data = await res.json();
      if (data.transactions) {
        setWalletTransactions(data.transactions);
      }
    } catch (err) {
      console.error("Failed to load wallet transactions:", err);
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    const fetchJobs = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Fetch completed jobs
        const q = query(
          collection(db, "jobRequests"),
          where("artisanId", "==", user.uid),
          where("status", "==", "completed")
        );
        const snapshot = await getDocs(q);
        const jobs = snapshot.docs.map(d => ({ ...d.data(), requestId: d.id } as JobRequest));
        
        const groups: Record<string, EarningPeriod> = {};
        
        jobs.forEach(job => {
          const date = new Date(job.completedAt || job.createdAt);
          const startDate = new Date(date);
          let endDate = new Date(date);
          let periodKey = "";

          if (viewMode === "daily") {
            startDate.setHours(0,0,0,0);
            endDate.setHours(23,59,59,999);
            periodKey = `${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
          } else if (viewMode === "weekly") {
            const day = date.getDay() || 7; 
            startDate.setDate(date.getDate() - day + 1);
            startDate.setHours(0,0,0,0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23,59,59,999);
            periodKey = `${startDate.getFullYear()}-W${Math.ceil(startDate.getDate() / 7)}`;
          } else {
            startDate.setDate(1);
            startDate.setHours(0,0,0,0);
            endDate = new Date(startDate);
            endDate.setMonth(startDate.getMonth() + 1);
            endDate.setDate(0);
            endDate.setHours(23,59,59,999);
            periodKey = `${startDate.getFullYear()}-${startDate.getMonth()}`;
          }
          
          if (!groups[periodKey]) {
            groups[periodKey] = {
              periodKey,
              startDate,
              endDate,
              jobs: [],
              totalEarnings: 0,
              commissionOwed: 0,
              isPaid: true
            };
          }
          
          groups[periodKey].jobs.push(job);
          const earn = job.counterOfferAmount || job.offerAmount || 0;
          groups[periodKey].totalEarnings += earn;
          
          if (!(job as any).commissionPaid) {
            groups[periodKey].commissionOwed += earn * 0.20;
            groups[periodKey].isPaid = false;
          }
        });
        
        const sortedPeriods = Object.values(groups).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
        setPeriods(sortedPeriods);

        // Also fetch wallet transactions
        fetchWalletTx(user.uid);
      } catch (err) {
        console.error("Error fetching earnings", err);
        showAlert("Failed to load earnings data.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [showAlert, showPaymentModal, viewMode]);

  const handlePayCommission = async (method: "cash" | "paystack" | "wallet", reference?: string) => {
    if (!showPaymentModal) return;
    
    try {
      setLoading(true);
      if (method === "paystack") {
        const batchPromises = showPaymentModal.jobs
          .filter(job => !(job as any).commissionPaid)
          .map(job => updateDoc(doc(db, "jobRequests", job.requestId), { 
            commissionPaid: true,
            paidToPlatform: true,
            commissionSettled: true,
            commissionSettledAt: Date.now(),
            commissionPaymentMethod: "paystack",
            commissionReference: reference || null
          }));
        
        await Promise.all(batchPromises);
      }
      setShowPaymentModal(null);
      if (auth.currentUser) fetchWalletTx(auth.currentUser.uid);
      showAlert("Weekly commission paid successfully! Thank you.", "success");
    } catch (err) {
      console.error(err);
      showAlert("Failed to update records. Contact support.", "error");
    } finally {
      setLoading(false);
    }
  };

  const generateReceipt = async (period: EarningPeriod) => {
    const receiptContent = `NEED PLATFORM - EARNINGS RECEIPT
==============================
Period: ${period.startDate.toLocaleDateString()} to ${period.endDate.toLocaleDateString()}
Total Earned: NGN ${period.totalEarnings.toLocaleString()}
Total Platform Fee Paid: NGN ${(period.totalEarnings * 0.20).toLocaleString()}

Jobs Completed:
${period.jobs.map(j => {
  const dt = new Date(j.completedAt || j.createdAt);
  return `- ${j.subcategory} (${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}): NGN ${(j.counterOfferAmount || j.offerAmount || 0).toLocaleString()}`;
}).join('\n')}

Status: SETTLED
Date: ${new Date().toLocaleDateString()}
`;
    
    const fileName = `Receipt_NEED_${period.periodKey}.txt`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: receiptContent,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        showAlert(`Receipt saved to Documents folder as ${fileName}`, "success");
      } catch (err) {
        console.error("Filesystem error", err);
        showAlert("Failed to save receipt to device", "error");
      }
    } else {
      const blob = new Blob([receiptContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const filteredTransactions = walletTransactions.filter(tx => {
    if (txFilter === "topup") return tx.type === "topup";
    if (txFilter === "withdrawal") return tx.type === "withdrawal" || tx.type === "withdrawal_reversal";
    if (txFilter === "commission") return tx.type === "commission_charge";
    return true;
  });

  const totalFunded = walletTransactions
    .filter(tx => tx.type === "topup")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWithdrawn = walletTransactions
    .filter(tx => tx.type === "withdrawal" && tx.payoutStatus !== "failed")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const totalJobsCount = periods.reduce((sum, p) => sum + p.jobs.length, 0);

  if (loading) return <div className="h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center"><GlobalSpinner text="LOADING PAYMENT HISTORY" /></div>;

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header */}
      <div className="bg-[var(--color-brutal-yellow)] border-b-8 border-black p-4 pt-16 flex items-center shrink-0 shadow-[0_4px_0_0_#000] z-10">
        <button 
          onClick={() => router.back()}
          className="w-12 h-12 bg-white border-4 border-black flex justify-center items-center mr-4 brutal-shadow hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-transform"
        >
          <ChevronLeft className="w-8 h-8 stroke-[3]" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-black uppercase tracking-tighter leading-none">Payment History</h1>
          <p className="font-bold text-black text-sm uppercase mt-1 tracking-widest border-t-2 border-black pt-1 inline-block">
            Settlements, Withdrawals & Account Funding
          </p>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto max-w-6xl mx-auto w-full">
        {/* Wallet Balance & Funding/Withdrawal Actions */}
        <WalletCard />

        {/* Primary View Switcher: Jobs vs Wallet Activity */}
        <div className="grid grid-cols-2 border-4 border-black bg-white brutal-shadow mb-6">
          <button
            onClick={() => setActiveTab("jobs")}
            className={`py-4 px-3 font-black uppercase text-sm md:text-base border-r-4 border-black flex items-center justify-center gap-2 transition-colors ${
              activeTab === "jobs"
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-[var(--color-brutal-bg)]"
            }`}
          >
            <span>💼 Jobs & Settlements</span>
            <span className={`text-xs px-2 py-0.5 border-2 ${activeTab === 'jobs' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'}`}>
              {totalJobsCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("wallet")}
            className={`py-4 px-3 font-black uppercase text-sm md:text-base flex items-center justify-center gap-2 transition-colors ${
              activeTab === "wallet"
                ? "bg-black text-white"
                : "bg-white text-black hover:bg-[var(--color-brutal-bg)]"
            }`}
          >
            <span>💳 Wallet & Funding</span>
            <span className={`text-xs px-2 py-0.5 border-2 ${activeTab === 'wallet' ? 'bg-white text-black border-white' : 'bg-black text-white border-black'}`}>
              {walletTransactions.length}
            </span>
          </button>
        </div>

        {/* TAB 1: JOBS & SETTLEMENTS */}
        {activeTab === "jobs" && (
          <div>
            {/* Toggle Periods */}
            <div className="flex border-4 border-black bg-white brutal-shadow-sm mb-8">
              {(['daily', 'weekly', 'monthly'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex-1 py-3 px-2 font-black uppercase text-sm md:text-base transition-colors ${
                    viewMode === mode 
                      ? 'bg-black text-white' 
                      : 'bg-white text-black hover:bg-[var(--color-brutal-bg)] border-r-4 border-black last:border-r-0'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="space-y-8">
              {periods.length === 0 ? (
                <div className="bg-white border-4 border-black p-8 text-center brutal-shadow rotate-1">
                  <p className="font-black text-2xl uppercase mb-2">No completed jobs yet</p>
                  <p className="font-bold text-gray-600">Complete jobs to see your {viewMode} breakdown.</p>
                </div>
              ) : (
                periods.map((period) => (
                  <div key={period.periodKey} className="bg-white border-4 border-black brutal-shadow-sm flex flex-col">
                    <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-black">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        <span className="font-black uppercase tracking-widest text-sm md:text-base">
                          {viewMode === 'daily' 
                            ? period.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : `${period.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${period.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        </span>
                      </div>
                      {period.isPaid ? (
                        <span className="bg-[var(--color-brutal-green)] text-black px-3 py-1 text-xs font-black uppercase border-2 border-white rotate-2">
                          Settled
                        </span>
                      ) : (
                        <span className="bg-[var(--color-brutal-red)] text-white px-3 py-1 text-xs font-black uppercase border-2 border-white -rotate-2">
                          Pending ({period.jobs.filter(j => !(j as any).commissionPaid).length})
                        </span>
                      )}
                    </div>
                  
                    <div className="p-6">
                      <div className="flex justify-between items-end mb-6 pb-6 border-b-4 border-black border-dashed">
                        <div>
                          <p className="text-sm font-bold text-gray-600 uppercase mb-1">Total Earned</p>
                          <p className="text-4xl font-black text-[var(--color-brutal-teal)]">₦{period.totalEarnings.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[var(--color-brutal-red)] uppercase mb-1">Unpaid Platform Fee</p>
                          <p className="text-2xl font-black text-black">₦{period.commissionOwed.toLocaleString()}</p>
                        </div>
                      </div>

                      {period.commissionOwed > 0 && !period.isPaid && (
                        <button 
                          onClick={() => setShowPaymentModal(period)}
                          className="w-full bg-[var(--color-brutal-blue)] text-black border-4 border-black py-4 font-black text-lg uppercase mb-6 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all"
                        >
                          PAY COMMISSION (₦{period.commissionOwed.toLocaleString()})
                        </button>
                      )}
                      
                      {period.isPaid && period.totalEarnings > 0 && (
                        <button 
                          onClick={() => generateReceipt(period)}
                          className="w-full bg-[var(--color-brutal-green)] text-black border-4 border-black py-4 font-black text-lg uppercase mb-6 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all flex items-center justify-center gap-2"
                        >
                          <ArrowUpRight className="w-6 h-6 stroke-[3]" />
                          DOWNLOAD RECEIPT
                        </button>
                      )}
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-2">
                          <p className="font-black uppercase text-sm">Jobs Completed ({period.jobs.length})</p>
                          <span className="text-xs font-bold text-gray-500 uppercase">Exact Completion Time Shown</span>
                        </div>
                        {period.jobs.map(job => (
                          <JobEarningRow key={job.requestId} job={job} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: WALLET & FUNDING HISTORY */}
        {activeTab === "wallet" && (
          <div className="space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-[var(--color-brutal-green)] border-2 border-black flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-black stroke-[3]" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-gray-600">Total Account Funded</span>
                </div>
                <p className="text-3xl font-black text-[var(--color-brutal-green)]">
                  ₦{(totalFunded / 100).toLocaleString()}
                </p>
                <p className="text-[11px] font-bold text-gray-500 mt-0.5">Via Card, Bank Transfer & USSD</p>
              </div>

              <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-[var(--color-brutal-teal)] border-2 border-black flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-black stroke-[3]" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-gray-600">Total Withdrawn</span>
                </div>
                <p className="text-3xl font-black text-black">
                  ₦{(totalWithdrawn / 100).toLocaleString()}
                </p>
                <p className="text-[11px] font-bold text-gray-500 mt-0.5">Transferred to linked bank accounts</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-black uppercase text-gray-600 shrink-0 flex items-center gap-1 mr-1">
                <Filter className="w-4 h-4" /> Filter:
              </span>
              {[
                { key: "all", label: "All Activities" },
                { key: "topup", label: "📥 Account Funding" },
                { key: "withdrawal", label: "📤 Withdrawals" },
                { key: "commission", label: "⚖️ Commissions" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setTxFilter(f.key as any)}
                  className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black whitespace-nowrap transition-transform ${
                    txFilter === f.key 
                      ? "bg-black text-white shadow-[2px_2px_0_0_#000] -translate-y-0.5" 
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Transactions List */}
            {loadingTx ? (
              <div className="bg-white border-4 border-black p-12 text-center shadow-[4px_4px_0_0_#000]">
                <GlobalSpinner text="LOADING WALLET TRANSACTIONS..." />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="bg-white border-4 border-black p-8 text-center shadow-[4px_4px_0_0_#000]">
                <p className="font-black text-xl uppercase mb-1">No transactions found</p>
                <p className="text-sm font-bold text-gray-600">
                  {txFilter === "all" 
                    ? "Fund your account or withdraw funds to see transaction history here." 
                    : `No ${txFilter} transactions recorded yet.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map(tx => (
                  <WalletTxRow key={tx.txId} tx={tx} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showPaymentModal && (
        <PaymentModal 
          amount={showPaymentModal.commissionOwed}
          email={auth.currentUser?.email || ""}
          jobs={showPaymentModal.jobs}
          onSuccess={handlePayCommission}
          onClose={() => setShowPaymentModal(null)}
        />
      )}
    </div>
  );
}

export default function EarningsPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center"><GlobalSpinner text="LOADING..." /></div>}>
      <EarningsContent />
    </Suspense>
  );
}
