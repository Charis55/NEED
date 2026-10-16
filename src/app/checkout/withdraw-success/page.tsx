"use client";

import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function WithdrawSuccessContent() {
  const searchParams = useSearchParams();
  const amountStr = searchParams.get("amount");
  const reference = searchParams.get("reference");
  const amountKobo = amountStr ? parseInt(amountStr, 10) : null;

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white brutal-card p-8 text-center flex flex-col items-center shadow-[8px_8px_0_0_#000] border-4 border-black">
        
        <div className="w-24 h-24 rounded-full border-4 border-black bg-[var(--color-brutal-teal)] flex items-center justify-center mb-6 shadow-[4px_4px_0_0_#000]">
          <CheckCircle className="w-14 h-14 text-black stroke-[3]" />
        </div>
        
        <h1 className="text-4xl font-black uppercase tracking-tighter text-black mb-3 leading-none">
          Withdrawal Initiated!
        </h1>

        {amountKobo && !isNaN(amountKobo) ? (
          <div className="my-2 px-4 py-2 bg-[var(--color-brutal-yellow)] border-2 border-black font-black text-xl text-black inline-block">
            ₦{(amountKobo / 100).toLocaleString("en-NG")} REQUESTED
          </div>
        ) : null}

        <p className="text-base font-bold text-gray-800 my-4 border-t-4 border-b-4 border-black py-4 w-full leading-relaxed">
          Your withdrawal request has been submitted and is being processed by Paystack. Funds will arrive in your linked bank account shortly.
        </p>

        {reference ? (
          <p className="text-[11px] font-mono text-gray-500 uppercase mb-4 break-all max-w-full px-2 text-center">
            REF: {reference}
          </p>
        ) : null}

        <div className="w-full space-y-3 pt-2">
          <Link 
            href="/technician/dashboard"
            className="w-full bg-[var(--color-brutal-yellow)] brutal-btn py-4 text-black font-black uppercase tracking-widest text-lg hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all block text-center border-4 border-black shadow-[4px_4px_0_0_#000]"
          >
            Back to Dashboard
          </Link>

          <Link 
            href="/technician/earnings"
            className="w-full bg-white text-black font-black uppercase tracking-wider text-xs py-3 border-2 border-black hover:bg-gray-100 transition-colors block text-center"
          >
            View Wallet & Earnings
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function WithdrawSuccessPage() {
  return (
    <Suspense fallback={<div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans"><Loader2 className="w-24 h-24 text-[var(--color-brutal-teal)] animate-spin" /></div>}>
      <WithdrawSuccessContent />
    </Suspense>
  );
}
