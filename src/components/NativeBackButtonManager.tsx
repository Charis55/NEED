"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getActiveBackHandler } from "@/hooks/useBackButton";
import { triggerHaptic } from "@/utils/haptics";
import { ImpactStyle } from "@capacitor/haptics";

export default function NativeBackButtonManager() {
  const router = useRouter();

  // 1. Android Native Back Button Support
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener("backButton", ({ canGoBack }) => {
      triggerHaptic(ImpactStyle.Light);
      const activeHandler = getActiveBackHandler();
      
      if (activeHandler) {
        // If an overlay/modal is open and registered a handler, execute it
        activeHandler();
      } else {
        // Otherwise use standard Next.js back navigation
        if (canGoBack) {
          router.back();
        } else {
          // If we are at the very root of the history, exit the app
          App.exitApp();
        }
      }
    });

    return () => {
      listener.then(sub => sub.remove());
    };
  }, [router]);

  // 2. iOS Universal Edge-Swipe-To-Go-Back Gesture
  useEffect(() => {
    if (typeof window === "undefined") return;

    let touchStartX = 0;
    let touchStartY = 0;
    let isEdgeSwipe = false;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      
      // Only initiate if starting within 35px of the left edge of screen
      if (touch.clientX <= 35) {
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        isEdgeSwipe = true;
      } else {
        isEdgeSwipe = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwipe || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaY = Math.abs(touch.clientY - touchStartY);
      const deltaX = touch.clientX - touchStartX;

      // If vertical movement dominates, cancel edge swipe
      if (deltaY > deltaX * 1.2 && deltaY > 30) {
        isEdgeSwipe = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);
      const elapsedTime = Date.now() - touchStartTime;

      isEdgeSwipe = false;

      // Qualified edge swipe: moved right by at least 60px with horizontal dominance in under 600ms
      if (deltaX >= 60 && deltaY < deltaX * 0.85 && elapsedTime < 600) {
        triggerHaptic(ImpactStyle.Light);
        const activeHandler = getActiveBackHandler();

        if (activeHandler) {
          activeHandler();
        } else {
          // Navigate back in history
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push("/explore");
          }
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [router]);

  return null;
}
