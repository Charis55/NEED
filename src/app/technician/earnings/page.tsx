"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { ChevronLeft, Calendar, DollarSign, ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAlert } from "@/components/AlertProvider";
import dynamicImport from "next/dynamic";
const PaymentModal = dynamicImport(() => import("@/components/PaymentModal"), { ssr: false });

interface WeeklyEarning {
  weekKey: string;
  startDate: Date;
  endDate: Date;
  jobs: JobRequest[];
  totalEarnings: number;
  commissionOwed: number;
  isPaid: boolean;
}

type JobWithFee = JobRequest & { platformFee: number };

const JobEarningRow = ({ job }: { job: JobRequest }) => {
  const [expanded, setExpanded] = useState(false);
  const earn = job.counterOfferAmount || job.offerAmount || 0;
  const platformFee = earn * 0.20;
  const isSettled = (job as any).commissionPaid;
  
  return (
    <div className="border-2 border-black mb-3 bg-gray-50 flex flex-col">
      <div 
        onClick={() => setExpanded(!expanded)} 
        className="flex justify-between items-center p-3 hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="w-5 h-5 stroke-[3] shrink-0" /> : <ChevronDown className="w-5 h-5 stroke-[3] shrink-0" />}
          <div>
            <p className="font-bold uppercase text-sm flex-1 break-words pr-2">{job.subcategory}</p>
            <p className="text-xs font-bold text-gray-500 flex flex-col items-start">
              <span>{new Date(job.completedAt || job.createdAt).toLocaleDateString('en-GB')}</span>
              <span className="text-[10px] uppercase text-black mt-0.5">{new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(job.completedAt || job.createdAt))}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
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
          <div className="flex justify-between mb-2">
             <span className="text-sm font-bold text-gray-600">Total Earned</span>
             <span className="text-sm font-black">₦{earn.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-2">
             <span className="text-sm font-bold text-[var(--color-brutal-red)]">Platform Fee (20%)</span>
             <span className="text-sm font-black text-[var(--color-brutal-red)]">- ₦{platformFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-6 pb-2 border-b-2 border-black">
             <span className="text-base font-black">Your Take Home</span>
             <span className="text-base font-black text-[var(--color-brutal-teal)]">₦{(earn - platformFee).toLocaleString()}</span>
          </div>
          
        </div>
      )}
    </div>
  )
}

export default function EarningsPage() {
  const [loading, setLoading] = useState(true);
  const [weeklyEarnings, setWeeklyEarnings] = useState<WeeklyEarning[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState<WeeklyEarning | null>(null);
  
  const router = useRouter();
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchJobs = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const q = query(
          collection(db, "jobRequests"),
          where("artisanId", "==", user.uid),
          where("status", "==", "completed")
        );
        const snapshot = await getDocs(q);
        const jobs = snapshot.docs.map(d => ({ ...d.data(), requestId: d.id } as JobRequest));
        
        // Group by week (ISO 8601 week)
        const groups: Record<string, WeeklyEarning> = {};
        
        jobs.forEach(job => {
          const date = new Date(job.completedAt || job.createdAt);
          // Set to Monday of that week
          const day = date.getDay() || 7; 
          const startDate = new Date(date);
          startDate.setDate(date.getDate() - day + 1);
          startDate.setHours(0,0,0,0);
          
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23,59,59,999);
          
          const weekKey = `${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
          
          if (!groups[weekKey]) {
            groups[weekKey] = {
              weekKey,
              startDate,
              endDate,
              jobs: [],
              totalEarnings: 0,
              commissionOwed: 0,
              isPaid: true
            };
          }
          
          groups[weekKey].jobs.push(job);
          const earn = job.counterOfferAmount || job.offerAmount || 0;
          groups[weekKey].totalEarnings += earn;
          
          if (!(job as any).commissionPaid) {
            groups[weekKey].commissionOwed += earn * 0.20;
            groups[weekKey].isPaid = false;
          }
        });
        
        const sortedWeeks = Object.values(groups).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
        setWeeklyEarnings(sortedWeeks);
      } catch (err) {
        console.error("Error fetching earnings", err);
        showAlert("Failed to load earnings data.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [showAlert, showPaymentModal]); // Refetch when a payment completes

  const handlePayCommission = async (method: "cash" | "paystack", reference?: string) => {
    if (!showPaymentModal || method !== "paystack") return;
    
    try {
      setLoading(true);
      const batchPromises = showPaymentModal.jobs
        .filter(job => !(job as any).commissionPaid)
        .map(job => updateDoc(doc(db, "jobRequests", job.requestId), { commissionPaid: true }));
      
      await Promise.all(batchPromises);
      setShowPaymentModal(null);
      showAlert("Weekly commission paid successfully! Thank you.", "success");
    } catch (err) {
      console.error(err);
      showAlert("Failed to update records. Contact support.", "error");
    } finally {
      setLoading(false);
    }
  };

  const generateReceipt = (week: WeeklyEarning) => {
    const receiptContent = `NEED PLATFORM - WEEKLY RECEIPT
==============================
Week: ${week.startDate.toLocaleDateString()} to ${week.endDate.toLocaleDateString()}
Total Earned: NGN ${week.totalEarnings.toLocaleString()}
Total Platform Fee Paid: NGN ${(week.totalEarnings * 0.20).toLocaleString()}

Jobs Completed:
${week.jobs.map(j => `- ${j.subcategory}: NGN ${(j.counterOfferAmount || j.offerAmount || 0).toLocaleString()}`).join('\n')}

Status: SETTLED
Date: ${new Date().toLocaleDateString()}
`;
    
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_NEED_${week.weekKey}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center"><GlobalSpinner text="LOADING EARNINGS" /></div>;

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
            Weekly Settlements
          </p>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-8 max-w-3xl mx-auto w-full">
        {weeklyEarnings.length === 0 ? (
          <div className="bg-white border-4 border-black p-8 text-center brutal-shadow rotate-1">
            <p className="font-black text-2xl uppercase mb-2">No earnings yet</p>
            <p className="font-bold text-gray-600">Complete jobs to see your weekly breakdown.</p>
          </div>
        ) : (
          weeklyEarnings.map((week, index) => (
            <div key={week.weekKey} className="bg-white border-4 border-black brutal-shadow-sm flex flex-col">
              <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-black">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span className="font-black uppercase tracking-widest text-sm md:text-base">
                    Week of {week.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {week.isPaid ? (
                  <span className="bg-[var(--color-brutal-green)] text-black px-3 py-1 text-xs font-black uppercase border-2 border-white rotate-2">
                    Settled
                  </span>
                ) : (
                  <span className="bg-[var(--color-brutal-red)] text-white px-3 py-1 text-xs font-black uppercase border-2 border-white -rotate-2">
                    Pending ({week.jobs.filter(j => !(j as any).commissionPaid).length})
                  </span>
                )}
              </div>
              
              <div className="p-6">
                <div className="flex justify-between items-end mb-6 pb-6 border-b-4 border-black border-dashed">
                  <div>
                    <p className="text-sm font-bold text-gray-600 uppercase mb-1">Total Earned</p>
                    <p className="text-4xl font-black text-[var(--color-brutal-teal)]">₦{week.totalEarnings.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--color-brutal-red)] uppercase mb-1">Unpaid Platform Fee</p>
                    <p className="text-2xl font-black text-black">₦{week.commissionOwed.toLocaleString()}</p>
                  </div>
                </div>

                {week.commissionOwed > 0 && !week.isPaid && (
                   <button 
                     onClick={() => setShowPaymentModal(week)}
                     className="w-full bg-[var(--color-brutal-blue)] text-black border-4 border-black py-4 font-black text-lg uppercase mb-6 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all"
                   >
                     PAY WEEKLY COMMISSION (₦{week.commissionOwed.toLocaleString()})
                   </button>
                )}
                
                {week.isPaid && week.totalEarnings > 0 && (
                   <button 
                     onClick={() => generateReceipt(week)}
                     className="w-full bg-[var(--color-brutal-green)] text-black border-4 border-black py-4 font-black text-lg uppercase mb-6 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all flex items-center justify-center gap-2"
                   >
                     <ArrowUpRight className="w-6 h-6 stroke-[3]" />
                     DOWNLOAD RECEIPT
                   </button>
                )}
                
                <div className="space-y-3">
                  <p className="font-black uppercase text-sm border-b-2 border-black inline-block pb-1 mb-2">Jobs Completed ({week.jobs.length})</p>
                  {week.jobs.map(job => (
                    <JobEarningRow key={job.requestId} job={job} />
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showPaymentModal && (
        <PaymentModal 
          amount={showPaymentModal.commissionOwed}
          email={auth.currentUser?.email || ""}
          onSuccess={handlePayCommission}
          onClose={() => setShowPaymentModal(null)}
        />
      )}
    </div>
  );
}
