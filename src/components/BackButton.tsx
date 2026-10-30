"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function BackButton({ className, href }: { className?: string, href?: string }) {
  const router = useRouter();
  
  return (
    <motion.button 
      type="button"
      whileTap={{ scale: 0.92, x: 2, y: 2 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      onClick={() => href ? router.push(href) : router.back()}
      className={`w-10 h-10 bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[3px_3px_0_0_#000] flex items-center justify-center shrink-0 active:shadow-none hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform ${className || ""}`}
      aria-label="Back"
    >
      <ArrowLeft className="w-5 h-5 text-black stroke-[3]" />
    </motion.button>
  );
}
