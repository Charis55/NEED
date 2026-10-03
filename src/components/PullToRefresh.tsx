"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const MAX_PULL = 120;
  const THRESHOLD = 80;

  useEffect(() => {
    // Only enable if we are near the top of the page
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 10) {
        setStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY <= 10 && startY > 0) {
        const y = e.touches[0].clientY;
        const pull = y - startY;
        
        // Only pull if pulling downwards
        if (pull > 0) {
          // Prevent default scrolling when pulling down
          if (e.cancelable) e.preventDefault();
          setCurrentY(Math.min(pull * 0.4, MAX_PULL));
        }
      }
    };

    const handleTouchEnd = () => {
      if (currentY >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setCurrentY(THRESHOLD);
        
        // Trigger refresh natively
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        setCurrentY(0);
        setStartY(0);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    // passive: false is required to call preventDefault
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [startY, currentY, refreshing]);

  return (
    <div ref={containerRef} className="relative w-full min-h-screen">
      {/* Pull down indicator */}
      <div 
        className="fixed top-0 left-0 w-full flex justify-center items-end pb-4 transition-all duration-200 z-[9999] pointer-events-none bg-yellow-400 border-b-4 border-black"
        style={{ 
          height: `${refreshing ? THRESHOLD : currentY}px`, 
          transform: `translateY(${refreshing || currentY > 0 ? '0' : '-100%'})`
        }}
      >
        <div className="flex flex-col items-center justify-center gap-2">
           <div className={`w-8 h-8 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${refreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${currentY * 3}deg)` }}></div>
           <span className="font-bold text-xs uppercase tracking-widest text-black">{refreshing ? 'RELOADING...' : 'PULL TO REFRESH'}</span>
        </div>
      </div>
      
      {/* Main Content Wrapper */}
      <div 
        className="transition-transform duration-200 min-h-screen"
        style={{ transform: (refreshing || currentY > 0) ? `translateY(${refreshing ? THRESHOLD : currentY}px)` : 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
