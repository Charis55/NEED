"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface StartupLoadingScreenProps {
  text?: string;
  subtext?: string;
  badge?: string;
}

export default function StartupLoadingScreen({
  text = "LOADING PROFILE",
  subtext = "Syncing your verified workspace...",
  badge = "CONNECTING",
}: StartupLoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[99999] min-h-screen w-screen bg-[#FFF9E6] flex flex-col items-center justify-between p-8 select-none overflow-hidden">
      {/* Top spacing / status bar headroom */}
      <div className="w-full pt-[calc(env(safe-area-inset-top,0px)+1rem)] flex justify-center opacity-0 pointer-events-none">
        <span className="text-xs font-black uppercase">NEED</span>
      </div>

      {/* Centerpiece: Logo + Brand + Dynamic Progress */}
      <div className="flex flex-col items-center justify-center max-w-sm w-full my-auto text-center">
        {/* Animated NEED Logo Hero */}
        <motion.div
          animate={{
            scale: [0.96, 1.03, 0.96],
            rotate: [0, -1, 1, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative mb-6"
        >
          {/* Yellow brutalist accent square behind logo */}
          <div className="absolute -inset-2 bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -rotate-2" />
          
          {/* White inner tile with logo */}
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
        </motion.div>

        {/* Brand Name Typography */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-black text-4xl sm:text-5xl tracking-tighter uppercase text-black leading-none">
            NEED
          </span>
          <motion.div 
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-3.5 h-3.5 bg-black"
          />
        </div>

        {/* Status Pill Badge */}
        <div className="mb-6">
          <span className="inline-block border-2 border-black bg-white text-black font-black text-xs uppercase tracking-widest px-3.5 py-1 -rotate-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            {text}
          </span>
        </div>

        {/* Neo-brutalist Striped Progress Track */}
        <div className="w-56 sm:w-64 h-4 border-3 border-black bg-white p-0.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-3 overflow-hidden">
          <motion.div
            className="h-full bg-[var(--color-brutal-green)] border-r-2 border-black"
            initial={{ width: "12%" }}
            animate={{
              width: ["12%", "75%", "40%", "92%", "25%"],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Subtle helper text */}
        {subtext && (
          <p className="text-xs font-bold text-black/60 tracking-tight">
            {subtext}
          </p>
        )}
      </div>

      {/* Clean Bottom Platform Tagline */}
      <div className="w-full pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-black/50">
          <span>ON-DEMAND SERVICES</span>
          <span>•</span>
          <span>VERIFIED ARTISANS</span>
        </div>
      </div>
    </div>
  );
}
