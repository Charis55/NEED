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
  text = "LOADING PROFILE...",
  subtext = "Syncing your workspace & profile",
  badge = "AUTHENTICATING",
}: StartupLoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[9999] min-h-screen bg-[var(--color-brutal-bg)] flex flex-col items-center justify-center p-6 select-none overflow-hidden">
      {/* Subtle background grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#000 1.5px, transparent 1.5px)`,
          backgroundSize: '20px 20px'
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xs sm:max-w-sm"
      >
        <div className="bg-white border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center">
          
          {/* Logo container with brutalist border and subtle floating pulse */}
          <motion.div
            animate={{
              y: [0, -4, 0],
              scale: [1, 1.025, 1],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative mb-5 p-3.5 bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -rotate-1 flex items-center justify-center"
          >
            <div className="relative w-20 h-20 sm:w-24 sm:h-24">
              <Image
                src="/LOGO.png"
                alt="NEED Logo"
                fill
                priority
                sizes="112px"
                className="object-contain drop-shadow-sm"
              />
            </div>
          </motion.div>

          {/* Brand header */}
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tighter uppercase leading-none">
              NEED
            </h1>
            <span className="w-3 h-3 bg-black animate-pulse" />
          </div>

          {/* Badge */}
          {badge && (
            <div className="mb-4">
              <span className="inline-block border-2 border-black bg-[var(--color-brutal-pink)] text-black text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rotate-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {badge}
              </span>
            </div>
          )}

          {/* Loading status bar */}
          <div className="w-full max-w-[200px] h-3.5 border-2 border-black bg-gray-100 p-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-3 overflow-hidden">
            <motion.div
              className="h-full bg-[var(--color-brutal-green)] border-r-2 border-black"
              initial={{ width: "15%" }}
              animate={{
                width: ["15%", "85%", "45%", "95%", "30%"],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          {/* Action text */}
          <p className="font-black text-xs sm:text-sm text-black uppercase tracking-wider mb-1">
            {text}
          </p>

          {/* Subtext */}
          {subtext && (
            <p className="text-[11px] sm:text-xs font-bold text-black/60 tracking-tight">
              {subtext}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
