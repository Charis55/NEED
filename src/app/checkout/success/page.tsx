"use client";

import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const initialJobId = searchParams.get("jobId");
  const requestedType = searchParams.get("type");
  const amountStr = searchParams.get("amount");

  const [verifying, setVerifying] = useState(true);
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(initialJobId);
  const [verifiedAmount, setVerifiedAmount] = useState<number | null>(amountStr ? parseInt(amountStr, 10) : null);
  const [detectedType, setDetectedType] = useState<string>(
    requestedType || (reference?.startsWith("topup_") ? "topup" : reference?.startsWith("with_") ? "withdraw" : "deposit")
  );

  useEffect(() => {
    if (!reference) {
      setVerifying(false);
      return;
    }

    // Verify transaction with server
    fetch("/api/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        reference, 
        jobId: initialJobId,
        type: requestedType === "topup" || reference.startsWith("topup_") ? "wallet_topup" : "deposit"
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.jobId) {
          setResolvedJobId(data.jobId);
        }
        if (data.amount) {
          setVerifiedAmount(data.amount);
        }
        if (data.type === "wallet_topup") {
          setDetectedType("topup");
        }
        setVerifying(false);
      })
      .catch((err) => {
        console.error("Verification failed:", err);
        setVerifying(false);
      });
  }, [reference, initialJobId, requestedType]);

  // RENDER SCREEN 2: TOP-UP / FUND ACCOUNT
  if (detectedType === "topup" || reference?.startsWith("topup_")) {
    return (
      <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white brutal-card p-8 text-center flex flex-col items-center shadow-[8px_8px_0_0_#000] border-4 border-black">
          {verifying ? (
            <>
              <div className="w-24 h-24 rounded-full border-4 border-black bg-[var(--color-brutal-yellow)] flex items-center justify-center mb-6 shadow-[4px_4px_0_0_#000]">
                <Loader2 className="w-14 h-14 text-black stroke-[3] animate-spin" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-black mb-3">
                Verifying Top-Up...
              </h1>
              <p className="text-base font-bold text-gray-700 border-t-4 border-b-4 border-black py-4 w-full">
                Please wait while we confirm your payment and credit your wallet balance.
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

  // RENDER SCREEN 3: WITHDRAW ACCOUNT
  if (detectedType === "withdraw" || reference?.startsWith("with_")) {
    return (
      <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white brutal-card p-8 text-center flex flex-col items-center shadow-[8px_8px_0_0_#000] border-4 border-black">
          <div className="w-24 h-24 rounded-full border-4 border-black bg-[var(--color-brutal-teal)] flex items-center justify-center mb-6 shadow-[4px_4px_0_0_#000]">
            <CheckCircle className="w-14 h-14 text-black stroke-[3]" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-black mb-3 leading-none">
            Withdrawal Initiated!
          </h1>
          {verifiedAmount ? (
            <div className="my-2 px-4 py-2 bg-[var(--color-brutal-yellow)] border-2 border-black font-black text-xl text-black inline-block">
              ₦{(verifiedAmount / 100).toLocaleString("en-NG")} REQUESTED
            </div>
          ) : null}
          <p className="text-base font-bold text-gray-800 my-4 border-t-4 border-b-4 border-black py-4 w-full leading-relaxed">
            Your withdrawal request has been submitted and is being processed by Paystack. Funds will arrive in your linked bank account shortly.
          </p>
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

  // RENDER SCREEN 1: DEPOSIT SUCCESS (Default for Job Bookings)
  const targetBookingUrl = resolvedJobId ? `/jobs/${resolvedJobId}` : "/jobs";

  return (
    <div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white brutal-card p-8 text-center flex flex-col items-center shadow-[8px_8px_0_0_#000] border-4 border-black">
        
        {verifying ? (
          <>
            <div className="w-24 h-24 rounded-full border-4 border-black bg-[var(--color-brutal-yellow)] flex items-center justify-center mb-6 shadow-[4px_4px_0_0_#000]">
              <Loader2 className="w-14 h-14 text-black stroke-[3] animate-spin" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-black mb-3">
              Verifying Payment...
            </h1>
            <p className="text-base font-bold text-gray-700 border-t-4 border-b-4 border-black py-4 w-full">
              Please wait while we confirm your deposit with Paystack.
            </p>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full border-4 border-black bg-[var(--color-brutal-teal)] flex items-center justify-center mb-6 shadow-[4px_4px_0_0_#000]">
              <CheckCircle className="w-14 h-14 text-black stroke-[3]" />
            </div>
            
            <h1 className="text-4xl font-black uppercase tracking-tighter text-black mb-4 leading-none">
              Payment Successful!
            </h1>
            
            <p className="text-base font-bold text-gray-800 mb-6 border-t-4 border-b-4 border-black py-4 w-full leading-relaxed">
              Your deposit has been secured and your job request is now confirmed. The technician has been notified.
            </p>

            <div className="w-full space-y-3">
              <Link 
                href={targetBookingUrl}
                className="w-full bg-[var(--color-brutal-yellow)] brutal-btn py-4 text-black font-black uppercase tracking-widest text-lg hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all block text-center border-4 border-black shadow-[4px_4px_0_0_#000]"
              >
                Manage Booking
              </Link>

              <Link 
                href="/jobs"
                className="block text-xs font-black uppercase tracking-wider text-gray-600 hover:text-black underline pt-1"
              >
                View All My Bookings
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="bg-[var(--color-brutal-bg)] min-h-screen flex flex-col items-center justify-center p-6 font-sans"><Loader2 className="w-24 h-24 text-[var(--color-brutal-teal)] animate-spin" /></div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
