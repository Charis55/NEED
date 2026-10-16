"use client";

import Link from "next/link";
import { CheckCircle, Loader2, Smartphone, ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiFetch, safeJsonParse } from "@/utils/apiBase";
import { Capacitor } from "@capacitor/core";

function TopupSuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const sourceParam = searchParams.get("source");
  const [verifying, setVerifying] = useState(true);
  const [verifiedAmount, setVerifiedAmount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Determine if this transaction originated from the native app or web
  const isFromApp = 
    sourceParam === "app" || 
    (!sourceParam && typeof window !== "undefined" && Capacitor.isNativePlatform());

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
        // Only if initiated from native mobile app, attempt auto-redirect back to app
        if (isFromApp && typeof window !== "undefined") {
          setTimeout(() => {
            try {
              window.location.href = "needapp://technician/dashboard";
            } catch (e) {
              // Ignore if deep link scheme cannot be opened
            }
          }, 800);
        }
      })
      .catch((err) => {
        console.error("Top-up verification failed:", err);
        setErrorMsg("Could not verify automatically. Please check your balance in the dashboard.");
        setVerifying(false);
      });
  }, [reference, isFromApp]);

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
              <div className="my-2 px-4 py-2 bg-[var(--color-brutal-yellow)] border-2 border-black font-black text-xl text-black inline-block shadow-[2px_2px_0_0_#000]">
                +₦{(verifiedAmount / 100).toLocaleString("en-NG")} CREDITED
              </div>
            ) : null}

            <p className="text-base font-bold text-gray-800 my-4 border-t-4 border-b-4 border-black py-4 w-full leading-relaxed">
              Your wallet has been funded successfully. Your updated balance is now live and available.
            </p>

            {errorMsg && (
              <p className="text-xs font-bold text-red-600 mb-4">{errorMsg}</p>
            )}

            <div className="w-full space-y-3 pt-2">
              {isFromApp ? (
                <>
                  <a 
                    href="needapp://technician/dashboard"
                    className="w-full bg-[var(--color-brutal-green)] py-4 text-black font-black uppercase tracking-widest text-lg hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all block text-center border-4 border-black shadow-[4px_4px_0_0_#000] flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-6 h-6 stroke-[3]" />
                    <span>RETURN TO NEED APP</span>
                  </a>

                  <Link 
                    href="/technician/dashboard"
                    className="w-full bg-[var(--color-brutal-yellow)] py-3 text-black font-black uppercase tracking-widest text-sm hover:bg-black hover:text-white transition-all block text-center border-2 border-black"
                  >
                    RETURN TO DASHBOARD
                  </Link>
                </>
              ) : (
                <Link 
                  href="/technician/dashboard"
                  className="w-full bg-[var(--color-brutal-green)] py-4 text-black font-black uppercase tracking-widest text-lg hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all block text-center border-4 border-black shadow-[4px_4px_0_0_#000] flex items-center justify-center gap-2"
                >
                  <span>RETURN TO DASHBOARD</span>
                  <ArrowRight className="w-6 h-6 stroke-[3]" />
                </Link>
              )}
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
