"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { motion } from "framer-motion";

interface DockSwipeNavigatorProps {
  routes: string[];
  children?: React.ReactNode;
}

export default function DockSwipeNavigator({ routes, children }: DockSwipeNavigatorProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isDockRoute = routes.includes(pathname);
  const currentIndex = routes.indexOf(pathname);

  // Full-screen fixed / immersive pages (chat, tracking, routing) must not have transform ancestors
  // which break `position: fixed; inset: 0;` viewport containment
  const isFullScreenPage = 
    pathname.startsWith("/chat") || 
    pathname.includes("/track") || 
    pathname.includes("/navigate");

  if (isFullScreenPage) {
    return <>{children}</>;
  }

  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const currentDragOffsetRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const activeRouteAtStartRef = useRef<string>(pathname);

  const triggerHaptic = (style: ImpactStyle = ImpactStyle.Medium) => {
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
        navigator.vibrate(22);
      }
    } catch (e) {
      // ignore
    }
  };

  // Prefetch all dock routes so tab switching is instant
  useEffect(() => {
    routes.forEach((route) => {
      try {
        router.prefetch(route);
      } catch (e) {
        // ignore prefetch errors
      }
    });
  }, [routes, router]);

  // Touch gesture handler for swiping between dock screens
  useEffect(() => {
    if (!isDockRoute || currentIndex === -1) {
      setDragOffset(0);
      setIsAnimating(false);
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isAnimating) return;

      const clientX = e.touches[0].clientX;
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 400;

      // 45px edge exclusion deadzone: protect iOS native edge swipe-to-go-back gesture
      const edgeDeadzone = 45;
      if (clientX < edgeDeadzone || clientX > windowWidth - edgeDeadzone) {
        startXRef.current = null;
        startYRef.current = null;
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, button, .leaflet-container, [data-no-swipe], .overflow-x-auto, .overflow-x-scroll"
        )
      ) {
        return;
      }

      startXRef.current = clientX;
      startYRef.current = e.touches[0].clientY;
      startTimeRef.current = Date.now();
      isHorizontalSwipeRef.current = null;
      currentDragOffsetRef.current = 0;
      activeRouteAtStartRef.current = pathname;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startXRef.current === null || startYRef.current === null || isAnimating) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startXRef.current;
      const diffY = currentY - startYRef.current;

      if (isHorizontalSwipeRef.current === null) {
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);
        if (absX > 8 || absY > 8) {
          isHorizontalSwipeRef.current = absX > absY * 1.35;
        }
      }

      if (isHorizontalSwipeRef.current) {
        if (e.cancelable) e.preventDefault();
        const dampenedOffset = diffX * 0.65;
        currentDragOffsetRef.current = dampenedOffset;

        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            setDragOffset(currentDragOffsetRef.current);
            rafIdRef.current = null;
          });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (
        startXRef.current === null ||
        startYRef.current === null ||
        !isHorizontalSwipeRef.current ||
        isAnimating ||
        activeRouteAtStartRef.current !== pathname
      ) {
        startXRef.current = null;
        startYRef.current = null;
        isHorizontalSwipeRef.current = null;
        setDragOffset(0);
        return;
      }

      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startXRef.current;
      const elapsed = Date.now() - startTimeRef.current;

      startXRef.current = null;
      startYRef.current = null;
      isHorizontalSwipeRef.current = null;

      // Swipe trigger criteria: > 50px distance or fast flick (< 350ms with > 30px)
      const isFastFlick = elapsed < 350 && Math.abs(diffX) > 30;
      const isFullSwipe = Math.abs(diffX) >= 50 && elapsed < 750;

      if (isFastFlick || isFullSwipe) {
        setIsAnimating(true);
        triggerHaptic(ImpactStyle.Medium);

        if (diffX < 0) {
          // Swiped LEFT -> Next dock tab
          const nextIndex = (currentIndex + 1) % routes.length;
          const nextRoute = routes[nextIndex];
          if (nextRoute && nextRoute !== pathname) {
            router.push(nextRoute);
          }
        } else {
          // Swiped RIGHT -> Previous dock tab
          const prevIndex = (currentIndex - 1 + routes.length) % routes.length;
          const prevRoute = routes[prevIndex];
          if (prevRoute && prevRoute !== pathname) {
            router.push(prevRoute);
          }
        }

        setTimeout(() => {
          setDragOffset(0);
          setIsAnimating(false);
        }, 220);
      } else {
        // Snap back with spring
        setIsAnimating(true);
        setDragOffset(0);
        setTimeout(() => {
          setIsAnimating(false);
        }, 200);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [pathname, isDockRoute, currentIndex, routes, router, isAnimating]);

  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 400;
  const dragFraction = Math.min(1, Math.abs(dragOffset) / windowWidth);

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, scale: 0.985, y: 6 }}
      animate={{
        opacity: isDockRoute ? Math.max(0.75, 1 - dragFraction * 0.35) : 1,
        scale: isDockRoute ? Math.max(0.97, 1 - dragFraction * 0.05) : 1,
        x: isDockRoute ? dragOffset * 0.35 : 0,
        y: 0,
      }}
      transition={
        isAnimating || dragOffset === 0
          ? { type: "spring", stiffness: 450, damping: 30 }
          : { duration: 0 }
      }
      className="w-full relative will-change-transform flex-1 flex flex-col min-h-0"
    >
      {children}
    </motion.div>
  );
}
