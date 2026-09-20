"use client";

import { useState } from "react";
import { usePaystackPayment } from "react-paystack";
import { X, CheckCircle } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { JobRequest } from "@/types";

interface PayCommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  unpaidJobs: JobRequest[];
  totalOwed: number;
  onSuccess: () => void;
}

export default function PayCommissionModal({ isOpen, onClose, unpaidJobs, totalOwed, onSuccess }: PayCommissionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const user = auth.currentUser;

  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || "technician@need.com",
    amount: Math.round(totalOwed * 100), // Amount is in kobo, must be integer
    publicKey: "pk_test_63d8908bfde0aa6dd46ce82d69a1ac301c7ee5a3",
  };

  const initializePayment = usePaystackPayment(config);

  const handlePaystackSuccessAction = async (reference: any) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      unpaidJobs.forEach((job) => {
        const jobRef = doc(db, "jobRequests", job.requestId);
        batch.update(jobRef, { paidToPlatform: true });
      });

      await batch.commit();
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Payment recorded with Paystack, but failed to update database. Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaystackCloseAction = () => {
    // Payment closed by user
    setLoading(false);
  };

  const startPayment = () => {
    if (totalOwed <= 0) return;
    setError("");
    
    try {
      initializePayment({
        onSuccess: handlePaystackSuccessAction,
        onClose: handlePaystackCloseAction,
      } as any);
    } catch (err) {
      console.error("Paystack initialization failed:", err);
      setError("Failed to open payment gateway. Please ensure you have a stable connection and no adblockers.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white border-8 border-black max-w-lg w-full max-h-[90vh] overflow-y-auto brutal-shadow relative p-6 md:p-8">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-[var(--color-brutal-red)] border-4 border-black flex justify-center items-center text-black brutal-shadow hover:-translate-y-1 transition-transform"
        >
          <X className="w-6 h-6 stroke-[3]" />
        </button>

        <h2 className="text-3xl font-black text-black uppercase tracking-tighter mb-6 border-b-4 border-black pb-4 inline-block">Pay Commission</h2>
        
        {error && (
          <div className="bg-[var(--color-brutal-red)] text-white p-4 brutal-border mb-6 font-bold uppercase text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <p className="text-gray-500 font-bold uppercase text-sm mb-2">Amount Due</p>
          <p className="text-5xl font-black text-black">₦{totalOwed.toLocaleString()}</p>
        </div>

        <div className="mb-8">
          <p className="text-gray-500 font-bold uppercase text-sm mb-3">For the following jobs:</p>
          <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
            {unpaidJobs.map(job => (
              <div key={job.requestId} className="flex justify-between items-center p-3 bg-[var(--color-brutal-bg)] border-2 border-black">
                <span className="font-bold text-black uppercase truncate mr-4">{job.subcategory}</span>
                <span className="font-black text-black">₦{job.platformFee?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={startPayment}
          disabled={loading || totalOwed <= 0}
          className="w-full bg-[var(--color-brutal-teal)] text-black py-4 brutal-btn text-xl uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="animate-pulse">Processing...</span>
          ) : (
            <>
              <CheckCircle className="w-6 h-6 stroke-[3]" />
              Pay via Paystack
            </>
          )}
        </button>
      </div>
    </div>
  );
}
