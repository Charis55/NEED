"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, BookOpen, Settings, BarChart2, DollarSign, Award, ArrowLeft, Scale } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: BarChart2 },
    { label: "Leakage Cases", href: "/admin/cases", icon: ShieldAlert },
    { label: "Strike Appeals", href: "/admin/appeals", icon: Scale },
    { label: "Ledger & Debts", href: "/admin/ledger", icon: DollarSign },
    { label: "Guarantee Claims", href: "/admin/guarantee", icon: Award },
    { label: "Platform Config", href: "/admin/config", icon: Settings },
  ];

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
        {children}
      </main>
    </div>
  );
}
