"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Inbox, Settings } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const navItems = [
  { href: "/technician/dashboard", icon: Home, label: "Home" },
  { href: "/technician/jobs", icon: ClipboardList, label: "Job Requests" },
  { href: "/technician/inbox", icon: Inbox, label: "Inbox" },
  { href: "/technician/settings", icon: Settings, label: "Settings" },
];

export default function ArtisanDock() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none px-2 sm:px-4 pb-[env(safe-area-inset-bottom,0.5rem)]">
      <nav className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] px-6 py-3 flex items-center gap-8 pointer-events-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={twMerge(
                clsx(
                  "flex flex-col items-center justify-center p-2 border-2 transition-all duration-200",
                  isActive 
                    ? "bg-[var(--color-brutal-green)] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-1" 
                    : "bg-transparent border-transparent text-black hover:border-black hover:bg-[var(--color-brutal-yellow)] hover:-translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                )
              )}
            >
              <Icon className="w-6 h-6 stroke-[3]" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
