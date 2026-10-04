"use client";

import React, { useState, useEffect, useRef } from "react";

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [currentY, setCurrentY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const refreshingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const MAX_PULL = 120;
  const THRESHOLD = 80;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 10 && e.touches[0].clientY < 180) {
        startYRef.current = e.touches[0].clientY;
      } else {
        startYRef.current = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY <= 10 && startYRef.current > 0) {
        const y = e.touches[0].clientY;
        const pull = y - startYRef.current;
        
        if (pull > 0) {
          if (e.cancelable) e.preventDefault();
          const calculatedY = Math.min(pull * 0.4, MAX_PULL);
          currentYRef.current = calculatedY;

          if (!rafIdRef.current) {
            rafIdRef.current = requestAnimationFrame(() => {
              setCurrentY(currentYRef.current);
              rafIdRef.current = null;
            });
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (currentYRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setCurrentY(THRESHOLD);
        
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else if (!refreshingRef.current) {
        currentYRef.current = 0;
        startYRef.current = 0;
        setCurrentY(0);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full min-h-screen">
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
