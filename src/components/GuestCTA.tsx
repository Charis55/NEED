"use client";

import Link from "next/link";
import { useOptionalAuth } from "@/hooks/useOptionalAuth";
import { UserPlus } from "lucide-react";

/**
 * GuestCTA — Shows a sign-up prompt for unauthenticated users.
 * Renders nothing for logged-in users.
 */
export default function GuestCTA({ 
  text = "Sign up to book technicians",
  className = ""
}: { 
  text?: string;
  className?: string;
}) {
  const { isGuest, loading } = useOptionalAuth();

  if (loading || !isGuest) return null;

  return (
    <div className={`bg-[var(--color-brutal-yellow)] border-4 border-black p-4 shadow-[4px_4px_0_0_#000] flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <UserPlus className="w-6 h-6 stroke-[3] flex-shrink-0" />
        <p className="font-black text-sm uppercase tracking-tight text-black">{text}</p>
      </div>
      <Link 
        href="/login?mode=signup"
        className="bg-black text-white px-4 py-2 font-black text-xs uppercase border-2 border-black hover:-translate-y-1 hover:shadow-[3px_3px_0_0_#000] transition-all flex-shrink-0"
      >
        JOIN FOR FREE
      </Link>
    </div>
  );
}
