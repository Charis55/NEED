"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

interface StartupLoadingScreenProps {
  progress?: number;
  text?: string;
  subtext?: string;
  badge?: string;
}

/**
 * Quantize percentage strictly into increments of 5 (e.g. 5, 10, 15, 20... 95, 100)
 */
function quantizeByFive(val: number): number {
  const clamped = Math.max(0, Math.min(100, val));
  return Math.min(100, Math.floor(clamped / 5) * 5);
}

export default function StartupLoadingScreen({
  progress,
  text,
  subtext,
  badge = "CONNECTING",
}: StartupLoadingScreenProps) {
  // Live percentage that ONLY increases monotonically in steps of 5
  const [percent, setPercent] = useState<number>(() => {
    return progress !== undefined ? quantizeByFive(progress) : 10;
  });

  // Track parent progress updates (strictly increasing by 5s)
  useEffect(() => {
    if (progress !== undefined) {
      const target = quantizeByFive(progress);
      setPercent((prev) => Math.max(prev, target));
    }
  }, [progress]);

  // Live progress ticker: while checking user profile data, smoothly advance in 5% increments
  useEffect(() => {
    // If progress is at 100, nothing more to tick
    if (percent >= 100) return;

    const interval = setInterval(() => {
      setPercent((prev) => {
        // If controlled progress is supplied and higher, use it
        if (progress !== undefined) {
          const target = quantizeByFive(progress);
          if (target > prev) return target;
          // Softly crawl up towards target or cap at 95% while waiting for network
          if (prev < target) return prev + 5;
          if (prev < 95 && target >= prev) return prev + 5;
          return prev;
        }

        // Live automatic crawl in 5% increments up to 95% while waiting for Firebase/auth
        if (prev < 95) {
          return prev + 5;
        }
        return prev;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [percent, progress]);

  // Dynamic status text reflecting actual live loading stages
  const dynamicStatus =
    text ||
    (percent < 30
      ? "Initializing session..."
      : percent < 55
      ? "Authenticating credentials..."
      : percent < 80
      ? "Fetching profile details..."
      : percent < 100
      ? "Syncing verified workspace..."
      : "Ready!");

  return (
    <div className="fixed inset-0 z-[99999] min-h-screen w-screen bg-[#FFF9E6] flex flex-col items-center justify-between p-8 select-none overflow-hidden">
      {/* Top spacing / status bar headroom */}
      <div className="w-full pt-[calc(env(safe-area-inset-top,0px)+1rem)] flex justify-center opacity-0 pointer-events-none">
        <span className="text-xs font-black uppercase">NEED</span>
      </div>

      {/* Centerpiece: Logo + Brand + Live Progress Bar */}
      <div className="flex flex-col items-center justify-center max-w-sm w-full my-auto text-center">
        {/* NEED Logo Hero with layered brutalist tiles */}
        <div className="relative mb-6">
          {/* Yellow brutalist accent shadow tile behind logo */}
          <div className="absolute -inset-2 bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-2" />

          {/* White inner tile with official NEED logo */}
          <div className="relative bg-white border-4 border-black p-4 rotate-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28">
              <Image
                src="/LOGO.png"
                alt="NEED Logo"
                fill
                priority
                sizes="(max-width: 640px) 112px, 128px"
                className="object-contain"
              />
            </div>
          </div>
        </div>

        {/* Brand Name Typography */}
        <div className="flex items-center gap-2 mb-4">
          <span className="font-black text-4xl sm:text-5xl tracking-tighter uppercase text-black leading-none">
            NEED
          </span>
          <div className="w-3.5 h-3.5 bg-black animate-pulse" />
        </div>

        {/* Live Progress Bar Header: Status + Live 5% Percentage */}
        <div className="w-56 sm:w-64 flex justify-between items-center mb-2 px-0.5">
          <span className="font-black text-[11px] sm:text-xs uppercase tracking-wider text-black text-left truncate pr-2">
            {dynamicStatus}
          </span>
          <span className="font-mono font-black text-xs text-black border-2 border-black bg-[var(--color-brutal-yellow)] px-2 py-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
            {percent}%
          </span>
        </div>

        {/* Live Progress Bar: Monotonically fills forward, never dances down */}
        <div className="w-56 sm:w-64 h-4 border-3 border-black bg-white p-0.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-3 overflow-hidden">
          <div
            className="h-full bg-[var(--color-brutal-green)] border-r-2 border-black transition-all duration-150 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Helper subtext */}
        <p className="text-xs font-bold text-black/60 tracking-tight">
          {subtext || "Loading user profile..."}
        </p>
      </div>

      {/* Clean Bottom Platform Tagline with TECHNICIANS */}
      <div className="w-full pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/50">
          <span>ON-DEMAND SERVICES</span>
          <span>•</span>
          <span>VERIFIED TECHNICIANS</span>
        </div>
      </div>
    </div>
  );
}
