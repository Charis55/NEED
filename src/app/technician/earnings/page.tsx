"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { JobRequest } from "@/types";
import GlobalSpinner from "@/components/GlobalSpinner";
import { ChevronLeft, Calendar, DollarSign, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAlert } from "@/components/AlertProvider";
import PaymentModal from "@/components/PaymentModal";

interface WeeklyEarning {
  weekKey: string;
  startDate: Date;
  endDate: Date;
  jobs: JobRequest[];
  totalEarnings: number;
  commissionOwed: number;
  isPaid: boolean;
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
          const earn = job.offerAmount || 0;
          groups[weekKey].totalEarnings += earn;
          groups[weekKey].commissionOwed += earn * 0.35;
          if (!(job as any).commissionPaid) {
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
  }, [showAlert]);

  const handlePayCommission = async (method: "cash" | "paystack", reference?: string) => {
    if (!showPaymentModal || method !== "paystack") return;
    
    try {
      setLoading(true);
      // Mark all jobs in this week as commission paid
      const promises = showPaymentModal.jobs.map(job => 
        updateDoc(doc(db, "jobRequests", job.requestId), { commissionPaid: true })
      );
      await Promise.all(promises);
      
      setWeeklyEarnings(prev => prev.map(w => 
        w.weekKey === showPaymentModal.weekKey ? { ...w, isPaid: true } : w
      ));
      
      setShowPaymentModal(null);
      showAlert("Commission paid successfully! Thank you.", "success");
    } catch (err) {
      console.error(err);
      showAlert("Failed to update records. Contact support.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center"><GlobalSpinner text="LOADING EARNINGS" /></div>;

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg)] flex flex-col font-sans selection:bg-[var(--color-brutal-pink)] selection:text-black">
      {/* Header */}
      <div className="bg-[var(--color-brutal-yellow)] border-b-8 border-black p-4 flex items-center shrink-0 shadow-[0_4px_0_0_#000] z-10">
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
                    Week of {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {week.isPaid ? (
                  <span className="bg-[var(--color-brutal-green)] text-black px-3 py-1 text-xs font-black uppercase border-2 border-white rotate-2">
                    Settled
                  </span>
                ) : (
                  <span className="bg-[var(--color-brutal-red)] text-white px-3 py-1 text-xs font-black uppercase border-2 border-white -rotate-2">
                    Pending
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
                    <p className="text-sm font-bold text-[var(--color-brutal-red)] uppercase mb-1">Platform Fee (35%)</p>
                    <p className="text-2xl font-black text-black">₦{week.commissionOwed.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <p className="font-black uppercase text-sm border-b-2 border-black inline-block pb-1">Jobs Completed ({week.jobs.length})</p>
                  {week.jobs.map(job => (
                    <div key={job.requestId} className="flex justify-between items-center bg-gray-50 border-2 border-black p-3 hover:bg-[var(--color-brutal-yellow)] transition-colors cursor-default">
                      <div>
                        <p className="font-bold uppercase text-sm truncate max-w-[200px]">{job.subcategory}</p>
                        <p className="text-xs font-bold text-gray-500">
                          {new Date(job.completedAt || job.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="font-black">₦{job.offerAmount?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {!week.isPaid && week.commissionOwed > 0 && (
                  <button 
                    onClick={() => setShowPaymentModal(week)}
                    className="w-full bg-[var(--color-brutal-blue)] text-black border-4 border-black py-4 font-black text-xl uppercase brutal-shadow hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all"
                  >
                    PAY COMMISSION (₦{week.commissionOwed.toLocaleString()})
                  </button>
                )}
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
