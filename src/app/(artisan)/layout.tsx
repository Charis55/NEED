import { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default function ArtisanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="bg-slate-800 shadow-md border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-amber-500">
            Technician Dashboard
          </Link>
          <nav>
            <SignOutButton className="text-slate-300 hover:text-white font-medium">
              Sign Out
            </SignOutButton>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
