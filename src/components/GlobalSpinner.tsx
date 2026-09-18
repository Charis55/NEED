"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlobalSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  color?: string;
}

export default function GlobalSpinner({ size = "md", text = "LOADING...", color = "bg-[var(--color-brutal-yellow)]" }: GlobalSpinnerProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24"
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <motion.div
        className={`${sizeClasses[size]} ${color} border-4 border-black brutal-shadow mb-6`}
        animate={{
          rotate: [0, 90, 180, 270, 360],
          scale: [1, 1.1, 1, 1.1, 1],
          borderRadius: ["0%", "20%", "50%", "20%", "0%"]
        }}
        transition={{
          duration: 1.5,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />
      {text && (
        <p className="font-black text-black uppercase tracking-widest border-2 border-black bg-white px-3 py-1 shadow-[2px_2px_0_0_#000] -rotate-1">
          {text}
        </p>
      )}
    </div>
  );
}
