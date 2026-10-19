"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface DockSwipeNavigatorProps {
  routes: string[];
  children?: React.ReactNode;
}

export default function DockSwipeNavigator({ routes, children }: DockSwipeNavigatorProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isDockRoute = routes.includes(pathname);
  const currentIndex = routes.indexOf(pathname);

  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const currentDragOffsetRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const prevPathnameRef = useRef<string>(pathname);

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

  // Prefetch all dock routes so page switching is instant
  useEffect(() => {
    routes.forEach((route) => {
      try {
        router.prefetch(route);
      } catch (e) {
        // ignore prefetch errors
      }
    });
  }, [routes, router]);

  // Handle incoming page entry animation when pathname changes
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      const prevIndex = routes.indexOf(prevPathnameRef.current);
      prevPathnameRef.current = pathname;

      if (prevIndex !== -1 && currentIndex !== -1) {
        // Determine entry direction
        // If moved forward or looped from end to 0
        const isForward = (currentIndex > prevIndex && !(prevIndex === 0 && currentIndex === routes.length - 1)) ||
                          (prevIndex === routes.length - 1 && currentIndex === 0);
        
        // Quick fluid slide-in from appropriate side
        setDragOffset(isForward ? 45 : -45);
        setIsAnimating(true);
        const timer = setTimeout(() => {
          setDragOffset(0);
          setIsAnimating(false);
          setSlideDirection(null);
        }, 30);
        return () => clearTimeout(timer);
      } else {
        setDragOffset(0);
        setIsAnimating(false);
        setSlideDirection(null);
      }
    }
  }, [pathname, currentIndex, routes]);

  useEffect(() => {
    // Strictly enable swipe ONLY on screens that are exact dock routes
    if (!isDockRoute || currentIndex === -1) {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isAnimating) return;

      const target = e.target as HTMLElement | null;
      // Ignore inputs, sliders, textareas, selects, maps, horizontal carousels
      if (
        target?.closest(
          "input, textarea, select, button, .leaflet-container, [data-no-swipe], .overflow-x-auto, .overflow-x-scroll"
        )
      ) {
        return;
      }

      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      startTimeRef.current = Date.now();
      isHorizontalSwipeRef.current = null;
      currentDragOffsetRef.current = 0;
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
          isHorizontalSwipeRef.current = absX > absY * 1.25;
        }
      }

      if (isHorizontalSwipeRef.current) {
        if (e.cancelable) e.preventDefault();
        // Dynamic finger drag with subtle resistance
        const dampenedOffset = diffX * 0.75;
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
        isAnimating
      ) {
        startXRef.current = null;
        startYRef.current = null;
        isHorizontalSwipeRef.current = null;
        return;
      }

      const endX = e.changedTouches[0].clientX;
      const diffX = endX - startXRef.current;
      const elapsed = Date.now() - startTimeRef.current;

      startXRef.current = null;
      startYRef.current = null;
      isHorizontalSwipeRef.current = null;

      // Swipe trigger criteria: > 45px distance or fast flick (< 350ms with > 25px)
      const isFastFlick = elapsed < 350 && Math.abs(diffX) > 25;
      const isFullSwipe = Math.abs(diffX) >= 45 && elapsed < 700;

      if (isFastFlick || isFullSwipe) {
        setIsAnimating(true);
        triggerHaptic(ImpactStyle.Medium);

        if (diffX < 0) {
          // Swiped LEFT -> Next dock tab
          const nextIndex = (currentIndex + 1) % routes.length;
          const nextRoute = routes[nextIndex];
          setSlideDirection("left");
          setDragOffset(-window.innerWidth * 0.95);

          setTimeout(() => {
            if (nextRoute && nextRoute !== pathname) {
              router.push(nextRoute);
            }
          }, 140);
        } else {
          // Swiped RIGHT -> Previous dock tab
          const prevIndex = (currentIndex - 1 + routes.length) % routes.length;
          const prevRoute = routes[prevIndex];
          setSlideDirection("right");
          setDragOffset(window.innerWidth * 0.95);

          setTimeout(() => {
            if (prevRoute && prevRoute !== pathname) {
              router.push(prevRoute);
            }
          }, 140);
        }
      } else {
        // Snap back to neutral position if swipe threshold was not met
        setIsAnimating(true);
        setDragOffset(0);
        setTimeout(() => {
          setIsAnimating(false);
        }, 180);
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

  // If not a dock route, render children statically
  if (!isDockRoute) {
    return <>{children}</>;
  }

  return (
    <div 
      className="w-full relative will-change-transform"
      style={{
        transform: `translate3d(${dragOffset}px, 0, 0)`,
        transition: isAnimating ? "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease" : "none",
        opacity: Math.max(0.4, 1 - Math.abs(dragOffset) / (typeof window !== "undefined" ? window.innerWidth * 1.8 : 800)),
      }}
    >
      {children}
    </div>
  );
}
