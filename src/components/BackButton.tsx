"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ className, href }: { className?: string, href?: string }) {
  const router = useRouter();
  
  return (
    <button 
      type="button"
      onClick={() => href ? router.push(href) : router.back()}
      className={`w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center transition ${className || 'bg-white text-gray-900 shadow-sm border border-gray-100 hover:bg-gray-50'}`}
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
}
