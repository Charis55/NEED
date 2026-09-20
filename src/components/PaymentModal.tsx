"use client";

import React, { useState } from "react";
import { usePaystackPayment } from "react-paystack";
import { CreditCard, Banknote, X, Loader2 } from "lucide-react";
import { useAlert } from "./AlertProvider";

interface PaymentModalProps {
  amount: number;
  email: string;
  onSuccess: (method: "paystack", reference?: string) => void;
  onClose: () => void;
}

export default function PaymentModal({ amount, email, onSuccess, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<"paystack" | null>(null);
  const [processing, setProcessing] = useState(false);
  const { showAlert } = useAlert();

  const config = {
    reference: (new Date()).getTime().toString(),
    email: email || "customer@example.com",
    amount: Math.round(amount * 100), // Paystack expects kobo/cents, must be integer
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_63d8908bfde0aa6dd46ce82d69a1ac301c7ee5a3",
  };

  const initializePayment = usePaystackPayment(config);

  const handlePaystack = () => {
    if (!config.publicKey) {
      showAlert("Payment system is not fully configured.", "error");
      return;
    }
    setMethod("paystack");
    
    try {
      initializePayment({
        onSuccess: (reference: any) => {
          setProcessing(true); // Only process after success
          onSuccess("paystack", reference.reference);
        },
        onClose: () => {
          setProcessing(false);
          showAlert("Payment window closed", "error");
        }
      } as any);
    } catch (e) {
      console.error(e);
      showAlert("Failed to initialize payment gateway.", "error");
    }
  };



  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white border-8 border-black p-6 w-full max-w-md brutal-shadow relative">
        <button 
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 bg-[var(--color-brutal-pink)] border-4 border-black flex items-center justify-center hover:-translate-y-1 transition-transform brutal-shadow z-10"
        >
          <X className="w-6 h-6 stroke-[3]" />
        </button>

        <h2 className="text-3xl font-black uppercase tracking-tighter mb-6 text-center">
          Complete Payment
        </h2>

        <div className="text-center mb-8">
          <p className="font-bold text-gray-600 uppercase text-sm mb-1">Total Amount Due</p>
          <p className="text-5xl font-black">₦{amount.toLocaleString()}</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handlePaystack}
            disabled={processing}
            className="w-full flex items-center justify-between bg-[var(--color-brutal-yellow)] text-black border-4 border-black p-4 brutal-shadow hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-y-0 active:shadow-none transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 stroke-[3]" />
              <span className="font-black uppercase text-lg">Pay with Card</span>
            </div>
            {processing && method === "paystack" && <Loader2 className="w-6 h-6 animate-spin" />}
          </button>
        </div>


        <p className="text-center text-xs font-bold mt-6 text-gray-500 uppercase">
          Secured by Paystack
        </p>
      </div>
    </div>
  );
}
