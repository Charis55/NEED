import { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <img src="/LOGO.png" alt="NEED Logo" className="h-8 w-auto" />
            </Link>
          <nav className="flex items-center gap-6">
            <Link href="/explore" className="text-gray-600 hover:text-emerald-500 font-medium transition">
              Explore
            </Link>
            <Link href="/jobs" className="text-gray-600 hover:text-emerald-500 font-medium transition">
              Bookings
            </Link>
            <SignOutButton className="text-gray-500 hover:text-gray-900 text-sm font-medium">
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
