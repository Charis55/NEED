"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function AdBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      if (adRef.current && !adRef.current.hasAttribute('data-adsbygoogle-status')) {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.error("AdSense error", err);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto mt-2 pointer-events-auto bg-[var(--color-brutal-yellow)] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative flex items-center p-1 group">
      
      {/* 
        TODO: ACTION REQUIRED TO MAKE MONEY
        1. Create a Google AdSense account (https://adsense.google.com)
        2. Replace "ca-pub-XXXXXXXXXXXXXXXX" with your actual Publisher ID in src/app/layout.tsx
        3. Replace "ca-pub-XXXXXXXXXXXXXXXX" below with your actual Publisher ID
        4. Replace "XXXXXXXXXX" with your actual Ad Slot ID below 
      */}
      
      <div className="flex-1 overflow-hidden flex justify-center items-center h-[50px] sm:h-[60px]">
        <ins
          className="adsbygoogle"
          style={{ display: "inline-block", width: "100%", height: "100%" }}
          data-ad-client="ca-pub-4445454590724783"
          data-ad-slot="XXXXXXXXXX"
          data-ad-format="auto"
          data-full-width-responsive="true"
          ref={adRef}
        />
      </div>

      <button 
        onClick={() => setIsVisible(false)}
        className="w-6 h-6 ml-2 shrink-0 border-2 border-black flex items-center justify-center bg-white hover:bg-[var(--color-brutal-red)] hover:text-white transition-colors self-start"
        title="Close Ad"
      >
        <X className="w-4 h-4 stroke-[3]" />
      </button>
    </div>
  );
}
