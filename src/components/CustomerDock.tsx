"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Inbox, Settings, Heart } from "lucide-react";
import { motion } from "framer-motion";
import AdUnit from "./AdUnit";

const navItems = [
  { href: "/explore", icon: Home, label: "Home" },
  { href: "/jobs", icon: ClipboardList, label: "Bookings" },
  { href: "/favorites", icon: Heart, label: "Favorites" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function CustomerDock() {
  const pathname = usePathname();

  // Hide dock on dedicated full-screen pages like Chat or live tracking
  const isHidden = 
    pathname.startsWith("/chat") ||
    pathname.includes("/track") ||
    pathname.includes("/navigate");

  if (isHidden) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center justify-center pointer-events-none px-2 sm:px-4 pb-[env(safe-area-inset-bottom,0.5rem)]">
      <nav className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-8 pointer-events-auto max-w-[calc(100vw-1rem)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="relative flex flex-col items-center justify-center p-2 transition-transform duration-150 active:scale-95"
            >
              {isActive && (
                <motion.div
                  layoutId="active-customer-dock-tab"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className="absolute inset-0 bg-[var(--color-brutal-green)] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-1 z-0"
                />
              )}
              <span className={`relative z-10 transition-transform ${isActive ? "-translate-y-1" : ""}`}>
                <Icon className="w-6 h-6 stroke-[3] text-black" />
              </span>
            </Link>
          );
        })}
      </nav>
      <AdUnit adSlot="3608382521" className="mt-2" />
    </div>
  );
}
