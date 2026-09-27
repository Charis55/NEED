"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-[var(--color-brutal-red)] text-white border-b-4 border-black p-2 z-[9999] flex items-center justify-center gap-2 shadow-[0_4px_0_0_#000]">
      <WifiOff className="w-5 h-5 stroke-[3]" />
      <span className="font-black uppercase tracking-widest text-sm">No Internet Connection</span>
    </div>
  );
}
