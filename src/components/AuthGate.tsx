"use client";

import { useOptionalAuth } from "@/hooks/useOptionalAuth";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import GlobalSpinner from "@/components/GlobalSpinner";

/**
 * AuthGate — Wraps pages that require authentication.
 * Shows a sign-in prompt instead of redirecting, so guests
 * can see what the page is about before committing.
 */
export default function AuthGate({ 
  children,
  title = "Sign in to continue",
  description = "Create a free account to access this feature."
}: { 
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { user, isGuest, loading } = useOptionalAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center">
        <GlobalSpinner text="LOADING" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg)] flex items-center justify-center p-6">
        <div className="bg-white brutal-card p-8 md:p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-[var(--color-brutal-yellow)] brutal-border brutal-shadow-sm flex items-center justify-center mx-auto mb-6 -rotate-3">
            <Lock className="w-10 h-10 text-black stroke-[3]" />
          </div>
          
          <h2 className="text-3xl font-black uppercase tracking-tighter text-black mb-2">{title}</h2>
          <p className="text-black font-bold mb-8 text-sm">{description}</p>
          
          <div className="flex flex-col gap-3">
            <Link
              href="/login?mode=signup"
              className="w-full bg-black !text-white brutal-btn py-4 text-lg flex items-center justify-between px-6"
            >
              <span className="font-black uppercase">Create Account</span>
              <ArrowRight className="w-6 h-6 stroke-[3]" />
            </Link>
            
            <Link
              href="/login"
              className="w-full bg-[var(--color-brutal-yellow)] text-black brutal-btn py-3 text-sm font-black uppercase"
            >
              Already have an account? Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
