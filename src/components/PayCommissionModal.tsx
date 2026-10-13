"use client";

import { useState, useEffect } from "react";
import { usePaystackPayment } from "react-paystack";
import { X, CheckCircle, Wallet, CreditCard, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, writeBatch } from "firebase/firestore";
import { JobRequest } from "@/types";
import { Wallet as WalletType } from "@/types/platform";
import { useAlert } from "./AlertProvider";

interface PayCommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  unpaidJobs?: JobRequest[];
  totalOwed: number;
  onSuccess?: (method: "wallet" | "paystack", reference?: string) => void;
  email?: string;
}

export default function PayCommissionModal({
  isOpen,
  onClose,
  unpaidJobs = [],
  totalOwed,
  onSuccess,
  email,
}: PayCommissionModalProps) {
  const { showAlert } = useAlert();
  const [processingWallet, setProcessingWallet] = useState(false);
  const [processingPaystack, setProcessingPaystack] = useState(false);
  const [error, setError] = useState("");
  const [walletBalanceNaira, setWalletBalanceNaira] = useState<number>(0);
  const [loadingWallet, setLoadingWallet] = useState(true);

  const user = auth.currentUser;

  // Real-time listener for current wallet balance
  useEffect(() => {
    if (!user || !isOpen) {
      setLoadingWallet(false);
      return;
    }

    const unsubWallet = onSnapshot(
      doc(db, "wallets", user.uid),
      (snap) => {
        if (snap.exists()) {
          const w = snap.data() as WalletType;
          // Balance is stored in Kobo, convert to Naira
          setWalletBalanceNaira(Math.round((w.balance || 0) / 100));
        } else {
          setWalletBalanceNaira(0);
        }
        setLoadingWallet(false);
      },
      (err) => {
        console.error("Wallet listener error:", err);
        setLoadingWallet(false);
      }
    );

    return () => unsubWallet();
  }, [user, isOpen]);

  const config = {
    reference: `comm_ps_${user?.uid || "tech"}_${Date.now()}`,
    email: email || user?.email || "technician@need.ng",
    amount: Math.round(totalOwed * 100), // Paystack expects lowest denomination (kobo)
    publicKey:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
      "pk_test_63d8908bfde0aa6dd46ce82d69a1ac301c7ee5a3",
  };

  const initializePayment = usePaystackPayment(config);

  const handlePayFromWallet = async () => {
    if (!user) {
      setError("Please sign in to process wallet payment.");
      return;
    }
    if (walletBalanceNaira < totalOwed) {
      setError(
        `Insufficient wallet balance. You have ₦${walletBalanceNaira.toLocaleString()}, but ₦${totalOwed.toLocaleString()} is required.`
      );
      return;
    }

    setProcessingWallet(true);
    setError("");

    try {
      const res = await fetch("/api/wallet/pay-commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          amount: totalOwed,
          jobIds: unpaidJobs.map((j) => j.requestId),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process commission from wallet");
      }

      showAlert(
        `Commission of ₦${totalOwed.toLocaleString()} paid from wallet successfully!`,
        "success"
      );
      onSuccess?.("wallet", data.reference);
      onClose();
    } catch (err: any) {
      console.error("Wallet commission error:", err);
      setError(err.message || "Failed to process payment from wallet");
    } finally {
      setProcessingWallet(false);
    }
  };

  const handlePaystackSuccessAction = async (reference: Record<string, unknown>) => {
    setProcessingPaystack(true);
    try {
      const refStr = (reference.reference as string) || `ps_${Date.now()}`;
      if (unpaidJobs.length > 0) {
        const batch = writeBatch(db);
        unpaidJobs.forEach((job) => {
          const jobRef = doc(db, "jobRequests", job.requestId);
          batch.update(jobRef, {
            paidToPlatform: true,
            commissionPaid: true,
            commissionSettled: true,
            commissionSettledAt: Date.now(),
            commissionPaymentMethod: "paystack",
            commissionReference: refStr,
          });
        });
        await batch.commit();
      }

      showAlert(`Commission paid via Paystack successfully!`, "success");
      onSuccess?.("paystack", refStr);
      onClose();
    } catch (err: any) {
      console.error("Paystack commission update error:", err);
      setError(
        "Payment recorded with Paystack, but failed to update job records. Please contact support."
      );
    } finally {
      setProcessingPaystack(false);
    }
  };

  const handlePaystackCloseAction = () => {
    setProcessingPaystack(false);
  };

  const startPaystackPayment = () => {
    if (totalOwed <= 0) return;
    setError("");
    setProcessingPaystack(true);
    try {
      initializePayment({
        onSuccess: handlePaystackSuccessAction,
        onClose: handlePaystackCloseAction,
      });
    } catch (err) {
      console.error("Paystack initialization failed:", err);
      setError(
        "Failed to open Paystack payment gateway. Please ensure popups are allowed and try again."
      );
      setProcessingPaystack(false);
    }
  };

  if (!isOpen) return null;

  const hasSufficientWalletBalance = walletBalanceNaira >= totalOwed;
  const isBusy = processingWallet || processingPaystack;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white border-8 border-black max-w-lg w-full max-h-[92vh] overflow-y-auto brutal-shadow relative p-6 md:p-8">
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="absolute top-4 right-4 w-10 h-10 bg-[var(--color-brutal-red)] border-4 border-black flex justify-center items-center text-black brutal-shadow hover:-translate-y-1 transition-transform disabled:opacity-50"
        >
          <X className="w-6 h-6 stroke-[3]" />
        </button>

        <h2 className="text-3xl font-black text-black uppercase tracking-tighter mb-4 border-b-4 border-black pb-3 inline-block">
          Pay Commission
        </h2>

        {error && (
          <div className="bg-[var(--color-brutal-red)] text-white p-4 border-4 border-black mb-6 font-bold uppercase text-xs flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-5">
          <p className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-1">
            Total Amount Due
          </p>
          <p className="text-5xl font-black text-black">
            ₦{totalOwed.toLocaleString()}
          </p>
        </div>

        {/* WALLET BALANCE STATUS CARD */}
        <div className="p-4 border-4 border-black bg-[var(--color-brutal-bg)] mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 font-black uppercase text-xs text-gray-700">
              <Wallet className="w-4 h-4 text-black" />
              <span>Available Wallet Balance</span>
            </div>
            <span className="font-black text-xl text-black">
              {loadingWallet ? "..." : `₦${walletBalanceNaira.toLocaleString()}`}
            </span>
          </div>

          {!loadingWallet && (
            hasSufficientWalletBalance ? (
              <p className="text-[11px] font-black text-green-700 uppercase flex items-center gap-1.5 mt-2 pt-2 border-t-2 border-black/20">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Sufficient balance for instant wallet payment</span>
              </p>
            ) : (
              <p className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1.5 mt-2 pt-2 border-t-2 border-black/20">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  ₦{(totalOwed - walletBalanceNaira).toLocaleString()} more needed to pay from wallet
                </span>
              </p>
            )
          )}
        </div>

        {/* UNPAID JOBS BREAKDOWN */}
        {unpaidJobs.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-500 font-bold uppercase text-xs tracking-wider mb-2">
              For {unpaidJobs.length} Completed Job{unpaidJobs.length > 1 ? "s" : ""}:
            </p>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {unpaidJobs.map((job) => (
                <div
                  key={job.requestId}
                  className="flex justify-between items-center p-2.5 bg-gray-50 border-2 border-black"
                >
                  <span className="font-bold text-black uppercase text-xs truncate mr-3">
                    {job.subcategory || job.trade}
                  </span>
                  <span className="font-black text-black text-xs whitespace-nowrap">
                    ₦{(job.platformFee || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {/* OPTION 1: PAY FROM WALLET */}
          <button
            type="button"
            onClick={handlePayFromWallet}
            disabled={isBusy || !hasSufficientWalletBalance || totalOwed <= 0}
            className={`w-full p-4 border-4 border-black font-black uppercase text-left transition-all flex items-center justify-between ${
              hasSufficientWalletBalance && !isBusy
                ? "bg-[var(--color-brutal-green)] text-black shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#000] active:translate-y-0 active:shadow-none"
                : "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center ${
                  hasSufficientWalletBalance ? "bg-white" : "bg-gray-200"
                }`}
              >
                <Wallet className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="font-black text-base leading-tight">Pay from Wallet</p>
                <p className="text-[11px] font-bold opacity-80 lowercase first-letter:uppercase">
                  Instant balance deduction • zero extra fees
                </p>
              </div>
            </div>

            {processingWallet ? (
              <Loader2 className="w-6 h-6 animate-spin text-black" />
            ) : (
              <span
                className={`font-black text-xs px-2.5 py-1 border-2 border-black ${
                  hasSufficientWalletBalance ? "bg-black text-white" : "bg-gray-200 text-gray-400 border-gray-400"
                }`}
              >
                ₦{totalOwed.toLocaleString()}
              </span>
            )}
          </button>

          {/* OPTION 2: PAY VIA PAYSTACK */}
          <button
            type="button"
            onClick={startPaystackPayment}
            disabled={isBusy || totalOwed <= 0}
            className="w-full p-4 border-4 border-black bg-[var(--color-brutal-yellow)] text-black font-black uppercase text-left shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#000] active:translate-y-0 active:shadow-none transition-all flex items-center justify-between disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-black bg-white flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="font-black text-base leading-tight">Pay with Paystack</p>
                <p className="text-[11px] font-bold opacity-80 lowercase first-letter:uppercase">
                  Debit card, bank transfer, ussd, internet banking
                </p>
              </div>
            </div>

            {processingPaystack ? (
              <Loader2 className="w-6 h-6 animate-spin text-black" />
            ) : (
              <ArrowRight className="w-6 h-6 stroke-[3]" />
            )}
          </button>
        </div>

        <p className="text-center text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-6">
          Secured by NEED & Paystack
        </p>
      </div>
    </div>
  );
}
