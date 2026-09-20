"use client";

import { useEffect } from "react";

interface AdUnitProps {
  adSlot: string;
  className?: string;
}

export default function AdUnit({ adSlot, className = "" }: AdUnitProps) {
  const publisherId = "ca-pub-4445454590724783";

  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("AdSense error:", err);
    }
  }, []);

  if (process.env.NODE_ENV !== "production") {
    // Return a placeholder during development to visualize ad placement
    return (
      <div className={`bg-gray-200 border-t-2 border-black border-dashed flex items-center justify-center p-2 h-10 w-full text-gray-500 font-black uppercase text-[10px] sm:text-xs ${className}`}>
        <span>Google AdSense Space &bull; <span className="text-gray-400 font-bold">(Slot: {adSlot})</span></span>
      </div>
    );
  }

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block" }}
      data-ad-client={publisherId}
      data-ad-slot={adSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
