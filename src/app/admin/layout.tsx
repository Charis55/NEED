"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, BookOpen, Settings, BarChart2, DollarSign, Award, ArrowLeft, Scale, UserX } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";

const ADMIN_EMAILS = ["obunezicharis@gmail.com"];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult();
        const hasAdminClaim = tokenResult.claims.admin === true;
        const isWhitelistedEmail = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
        setIsAuthorized(Boolean(hasAdminClaim || isWhitelistedEmail));
      } catch (err) {
        console.error("Failed to verify admin status:", err);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: BarChart2 },
    { label: "Blacklist & KYC", href: "/admin/blacklist", icon: UserX },
    { label: "Leakage Cases", href: "/admin/cases", icon: ShieldAlert },
    { label: "Strike Appeals", href: "/admin/appeals", icon: Scale },
    { label: "Ledger & Debts", href: "/admin/ledger", icon: DollarSign },
    { label: "Guarantee Claims", href: "/admin/guarantee", icon: Award },
    { label: "Platform Config", href: "/admin/config", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg,#FFFDF0)] flex flex-col items-center justify-center p-6 text-black">
        <div className="border-4 border-black bg-[var(--color-brutal-yellow,#FFD700)] p-8 shadow-[8px_8px_0_0_#000] flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
          <p className="font-black text-sm uppercase tracking-wider">Verifying Admin Authorization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[var(--color-brutal-bg,#FFFDF0)] flex flex-col items-center justify-center p-6 text-black select-none">
        <div className="border-4 border-black bg-[var(--color-brutal-red,#FF4D4D)] text-white p-8 shadow-[8px_8px_0_0_#000] flex flex-col items-center gap-4 max-w-md w-full text-center">
          <ShieldAlert className="w-16 h-16 text-black stroke-[2.5]" />
          <h2 className="text-3xl font-black uppercase text-black tracking-tight">ACCESS DENIED</h2>
          <p className="font-bold text-sm text-black bg-white p-3 border-2 border-black">
            You do not have administrative credentials to access the NEED Command Console.
          </p>
          <Link
            href="/"
            className="mt-4 px-6 py-3 bg-black text-white font-black text-sm uppercase border-2 border-white hover:bg-white hover:text-black hover:border-black transition-all shadow-[4px_4px_0_0_#000]"
          >
            Return to Application
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-mono text-black">
      {/* Admin Top Banner */}
      <header className="bg-black text-white px-6 py-4 border-b-4 border-black flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="bg-[var(--color-brutal-yellow,#FFD700)] text-black px-2 py-1 font-black text-xs uppercase flex items-center gap-1 border-2 border-white hover:bg-white transition-colors">
            <ArrowLeft className="w-3 h-3" /> Exit to App
          </Link>
          <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[var(--color-brutal-yellow,#FFD700)]" />
            NEED Admin &bull; Leakage & Ledger Command
          </h1>
        </div>
        <div className="text-xs bg-gray-800 px-3 py-1.5 border border-gray-600 font-bold">
          ADMIN ACCESS ONLY &bull; SECURE SERVER AUTHORITY
        </div>
      </header>

      {/* Admin Tab Navigation */}
      <nav className="bg-white border-b-4 border-black px-6 py-2 flex flex-wrap gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 font-black text-xs uppercase flex items-center gap-2 border-2 border-black transition-all shadow-[2px_2px_0_0_#000] ${
                isActive
                  ? "bg-[var(--color-brutal-yellow,#FFD700)] text-black -translate-y-0.5"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Admin Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, scale: 0.985, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 450, damping: 30 }}
          className="w-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
