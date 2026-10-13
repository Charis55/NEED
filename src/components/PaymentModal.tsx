"use client";

import PayCommissionModal from "./PayCommissionModal";
import { JobRequest } from "@/types";

interface PaymentModalProps {
  amount: number;
  email: string;
  onSuccess: (method: "paystack" | "wallet", reference?: string) => void;
  onClose: () => void;
  jobs?: JobRequest[];
}

export default function PaymentModal({
  amount,
  email,
  onSuccess,
  onClose,
  jobs = [],
}: PaymentModalProps) {
  return (
    <PayCommissionModal
      isOpen={true}
      totalOwed={amount}
      email={email}
      unpaidJobs={jobs}
      onSuccess={onSuccess}
      onClose={onClose}
    />
  );
}
