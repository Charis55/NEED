"use client";

import React, { useState, useEffect, useRef } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [currentY, setCurrentY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const refreshingRef = useRef(false);
  const thresholdReachedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const MAX_PULL = 110;
  const THRESHOLD = 72;

  const triggerHaptic = (style: ImpactStyle = ImpactStyle.Light) => {
    try {
      if (typeof window !== "undefined") {
        const webkit = (window as any).webkit;
        if (webkit?.messageHandlers?.haptic) {
          webkit.messageHandlers.haptic.postMessage("medium");
        } else {
          Haptics.impact({ style }).catch(() => {});
        }
      }
    } catch (e) {
      // fallback
    }
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    // On native iOS container with bounces disabled, bypass synthetic pull-to-refresh to keep scrolling native 120Hz
    if (typeof window !== "undefined" && (window as any).webkit?.messageHandlers?.needNative) {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Restrict pull-to-refresh activation to the top 25% of the screen (approx 200px) when scrolled to top
      const isTopQuarter = e.touches[0].clientY < Math.max(window.innerHeight * 0.25, 200);
      if (window.scrollY <= 2 && isTopQuarter) {
        startYRef.current = e.touches[0].clientY;
        thresholdReachedRef.current = false;
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
      } else {
        startYRef.current = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY <= 2 && startYRef.current > 0) {
        const y = e.touches[0].clientY;
        const pull = y - startYRef.current;
        
        if (pull > 0) {
          if (e.cancelable) e.preventDefault();
          // Logarithmic damping for natural elastic feel
          const calculatedY = Math.min(pull * 0.42, MAX_PULL);
          currentYRef.current = calculatedY;

          // Trigger haptic feedback when crossing pull threshold
          if (calculatedY >= THRESHOLD && !thresholdReachedRef.current) {
            thresholdReachedRef.current = true;
            triggerHaptic(ImpactStyle.Light);
          } else if (calculatedY < THRESHOLD && thresholdReachedRef.current) {
            thresholdReachedRef.current = false;
          }

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
      document.removeEventListener("touchmove", handleTouchMove);
      if (currentYRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setCurrentY(THRESHOLD);
        triggerHaptic(ImpactStyle.Medium);
        
        setTimeout(() => {
          window.location.reload();
        }, 400);
      } else if (!refreshingRef.current) {
        currentYRef.current = 0;
        startYRef.current = 0;
        setCurrentY(0);
        thresholdReachedRef.current = false;
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
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
      {/* Pull down indicator (Yellow brutalist drawer with Dynamic Island safe area) */}
      <div 
        className="fixed top-0 left-0 w-full flex justify-center items-end pb-3 transition-all duration-150 z-[9999] pointer-events-none bg-[var(--color-brutal-yellow,#FFE600)] border-b-4 border-black pt-[env(safe-area-inset-top,0px)] shadow-[0_4px_0_0_#000]"
        style={{ 
          height: `${refreshing ? THRESHOLD + 20 : Math.max(0, currentY)}px`, 
          transform: `translateY(${refreshing || currentY > 0 ? '0' : '-100%'})`
        }}
      >
        <div className="flex flex-col items-center justify-center gap-1.5">
           <div 
             className={`w-7 h-7 border-4 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${refreshing ? 'animate-spin' : ''}`} 
             style={{ transform: `rotate(${currentY * 3.5}deg)` }}
           />
           <span className="font-black text-[11px] uppercase tracking-wider text-black">
             {refreshing ? 'RELOADING...' : currentY >= THRESHOLD ? 'RELEASE TO REFRESH' : 'PULL TO REFRESH'}
           </span>
        </div>
      </div>
      
      {/* Main Content Wrapper */}
      <div 
        className="transition-transform duration-150 min-h-screen"
        style={{ transform: (refreshing || currentY > 0) ? `translateY(${refreshing ? THRESHOLD : currentY}px)` : 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
