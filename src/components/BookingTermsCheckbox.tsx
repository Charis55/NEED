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
          <div className="bg-white brutal-border w-full max-w-xl p-6 md:p-8 relative max-h-[85vh] overflow-y-auto shadow-[8px_8px_0_0_#000]">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 bg-white border-2 border-black px-3 py-1 text-black hover:bg-[var(--color-brutal-red)] hover:text-white font-black text-xs uppercase transition-colors"
            >
              CLOSE ✕
            </button>
            
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-4 pr-12 border-b-4 border-black pb-2">
              Booking Terms & Conditions
            </h3>
            
            <div className="space-y-4 text-xs md:text-sm font-medium text-black leading-relaxed">
              <div className="bg-[var(--color-brutal-bg)] p-3 border-2 border-black">
                <p className="font-black uppercase text-xs text-gray-700 mb-1">1. Deposit & Deferred Broadcast Payment Model</p>
                <p>
                  <strong>Direct Bookings:</strong> When requesting a specific technician directly, a 25% commitment deposit is required upfront to lock in the appointment.<br />
                  <strong>Broadcast Marketplace Jobs:</strong> Posting an open broadcast job to the community is 100% free with no deposit required at time of post. Once a verified technician accepts your job, a <strong>25% commitment deposit</strong> is immediately required to confirm the booking and dispatch the technician. Technicians are instructed not to travel until this deposit is safely secured.
                </p>
              </div>

              <div className="p-3 border-2 border-black">
                <p className="font-black uppercase text-xs text-gray-700 mb-1">2. Escrow Protection & Fund Security</p>
                <p>
                  All deposits are held securely in platform escrow by NEED. Funds are <strong>never</strong> released to the technician until the job is completed and you have inspected and approved the work. The remaining 75% balance is settled upon completion via in-app payment or cash-on-delivery.
                </p>
              </div>

              <div className="p-3 border-2 border-black">
                <p className="font-black uppercase text-xs text-gray-700 mb-1">3. Cancellation, En Route, & Refund Policies</p>
                <p>
                  • <strong>Before Technician Leaves:</strong> If you cancel before the technician marks themselves as &ldquo;En Route&rdquo;, your deposit is 100% refunded immediately.<br />
                  • <strong>After Technician is En Route:</strong> If cancelled while the technician is traveling, a fixed travel compensation fee is deducted from the deposit and paid to the technician; the remaining balance is refunded to you.<br />
                  • <strong>Technician No-Show or Cancellation:</strong> If the technician cancels or fails to arrive, you receive a full 100% refund or free rebooking.
                </p>
              </div>

              <div className="p-3 border-2 border-black">
                <p className="font-black uppercase text-xs text-gray-700 mb-1">4. Technician Representation & Workmanship Warranty</p>
                <p>
                  By claiming or accepting a job request, technicians legally certify that they possess the certified skills, tools, and experience necessary to complete the work to industry standards. All completed bookings are covered under the <strong>NEED 30-Day Workmanship Guarantee</strong>.
                </p>
              </div>

              <div className="bg-red-50 p-3 border-2 border-black">
                <p className="font-black uppercase text-xs text-red-700 mb-1">5. Non-Circumvention Policy</p>
                <p>
                  Users agree not to arrange offline payments or bypass the platform to avoid platform fees. Doing so voids all escrow protection and warranty guarantees and may lead to account suspension.
                </p>
              </div>

              <p className="pt-2 border-t-2 border-black text-xs font-bold">
                Read the comprehensive legal policies in our{" "}
                <Link href="/terms" target="_blank" className="text-[var(--color-brutal-blue)] underline font-black">
                  Official Terms of Service
                </Link>.
              </p>
            </div>
            
            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-6 bg-[var(--color-brutal-yellow)] py-3 brutal-border text-black font-black uppercase tracking-tighter hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[4px_4px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-none transition-all"
            >
              I UNDERSTAND & AGREE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
