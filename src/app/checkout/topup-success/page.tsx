"use client";

import Link from "next/link";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiFetch, safeJsonParse } from "@/utils/apiBase";

function TopupSuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const [verifying, setVerifying] = useState(true);
  const [verifiedAmount, setVerifiedAmount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setVerifying(false);
      return;
    }

    // Verify transaction with server and immediately credit wallet balance
    apiFetch("/api/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, type: "wallet_topup" }),
    })
      .then((res) => safeJsonParse(res))
      .then((data) => {
        if (data.amount) {
          setVerifiedAmount(data.amount);
        }
        setVerifying(false);
      })
      .catch((err) => {
        console.error("Top-up verification failed:", err);
        setErrorMsg("Could not verify automatically. Please check your balance in the dashboard.");
        setVerifying(false);
      });
  }, [reference]);

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white brutal-card p-8 text-center flex flex-col items-center shadow-[8px_8px_0_0_#000] border-4 border-black">
        
        {verifying ? (
          <>
            <div className="w-24 h-24 rounded-full border-4 border-black bg-[var(--color-brutal-yellow)] flex items-center justify-center mb-6 shadow-[4px_4px_0_0_#000]">
              <Loader2 className="w-14 h-14 text-black stroke-[3] animate-spin" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-black mb-3 leading-tight">
              Verifying Top-Up...
            </h1>
            <p className="text-base font-bold text-gray-700 border-t-4 border-b-4 border-black py-4 w-full">
              Please wait while we confirm your payment and credit your wallet.
            </p>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full border-4 border-black bg-[var(--color-brutal-green)] flex items-center justify-center mb-6 shadow-[4px_4px_0_0_#000]">
              <CheckCircle className="w-14 h-14 text-black stroke-[3]" />
            </div>
            
            <h1 className="text-4xl font-black uppercase tracking-tighter text-black mb-3 leading-none">
              Account Funded!
            </h1>

            {verifiedAmount ? (
              <div className="my-2 px-4 py-2 bg-[var(--color-brutal-yellow)] border-2 border-black font-black text-xl text-black inline-block">
                +₦{(verifiedAmount / 100).toLocaleString("en-NG")} CREDITED
              </div>
            ) : null}

            <p className="text-base font-bold text-gray-800 my-4 border-t-4 border-b-4 border-black py-4 w-full leading-relaxed">
              Your wallet has been funded successfully. Your updated balance is now available for platform transactions.
            </p>

            {errorMsg && (
              <p className="text-xs font-bold text-red-600 mb-4">{errorMsg}</p>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}

export default function TopupSuccessPage() {
  return (
    <Suspense fallback={<div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans"><Loader2 className="w-24 h-24 text-[var(--color-brutal-teal)] animate-spin" /></div>}>
      <TopupSuccessContent />
    </Suspense>
  );
}
