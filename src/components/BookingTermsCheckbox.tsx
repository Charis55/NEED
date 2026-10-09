import React, { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

interface BookingTermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function BookingTermsCheckbox({ checked, onChange }: BookingTermsCheckboxProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="bg-white brutal-border p-4 mb-8">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`w-6 h-6 shrink-0 mt-1 brutal-border flex items-center justify-center transition-colors ${
            checked ? "bg-[var(--color-brutal-blue)] text-white" : "bg-white"
          }`}
        >
          {checked && <Check className="w-4 h-4 stroke-[4]" />}
        </button>
        
        <div className="text-sm font-bold text-black leading-tight">
          <p>
            I agree to the{" "}
            <button 
              type="button" 
              onClick={() => setShowModal(true)}
              className="text-[var(--color-brutal-blue)] underline decoration-2 underline-offset-2 hover:text-black transition-colors"
            >
              Booking Terms & Conditions
            </button>
            , including the deposit requirement and cancellation policy.
          </p>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white brutal-border w-full max-w-lg p-6 relative max-h-[80vh] overflow-y-auto">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-black hover:text-[var(--color-brutal-red)] font-black"
            >
              CLOSE
            </button>
            
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-4 pr-12">Booking Terms & Conditions</h3>
            
            <div className="space-y-4 text-sm font-medium">
              <p>
                <strong>1. Deposit Requirement:</strong> To confirm a booking, you must pay a deposit. This deposit securely holds the artisan's time and covers the platform fee. NEED holds this money safely until your job is complete or cancelled.
              </p>
              <p>
                <strong>2. Cancellation & Refunds:</strong> If you cancel well in advance, your deposit is fully refunded. If you cancel after the artisan is en route, a travel compensation fee is deducted.
              </p>
              <p>
                <strong>3. Non-Circumvention:</strong> You agree not to bypass NEED to pay the artisan directly in cash for the purpose of avoiding the platform commission. If the artisan arrives and the job is cancelled but completed offline, the platform fee will be retained from your deposit.
              </p>
              <p>
                <strong>4. Location Sharing:</strong> During an active job, the artisan's location is shared with you to track arrival. 
              </p>
              <p className="pt-2 border-t-2 border-black">
                Read the full <Link href="/terms" target="_blank" className="text-[var(--color-brutal-blue)] underline font-bold">Terms of Service</Link>.
              </p>
            </div>
            
            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-6 bg-[var(--color-brutal-yellow)] py-3 brutal-border text-black font-black uppercase tracking-tighter hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[4px_4px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
