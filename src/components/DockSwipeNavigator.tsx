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
  const [isMorphEntering, setIsMorphEntering] = useState<boolean>(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const currentDragOffsetRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const prevPathnameRef = useRef<string>(pathname);
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

  // Handle morph entry animation when switching between dock routes
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      const prevIndex = routes.indexOf(prevPathnameRef.current);
      prevPathnameRef.current = pathname;

      if (prevIndex !== -1 && currentIndex !== -1) {
        // Start from morph entry state (subtle scale + blur cross-fade)
        setIsMorphEntering(true);
        setDragOffset(0);
        setIsAnimating(true);

        const timer = setTimeout(() => {
          setIsMorphEntering(false);
          setIsAnimating(false);
        }, 220);
        return () => clearTimeout(timer);
      } else {
        setDragOffset(0);
        setIsAnimating(false);
        setIsMorphEntering(false);
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

      const clientX = e.touches[0].clientX;
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 400;

      // CRITICAL: 45px edge exclusion deadzone
      // Never intercept iOS native edge swipe-to-go-back gesture (0-45px from left edge)
      // or edge forward gestures (> windowWidth - 45px)
      const edgeDeadzone = 45;
      if (clientX < edgeDeadzone || clientX > windowWidth - edgeDeadzone) {
        startXRef.current = null;
        startYRef.current = null;
        return;
      }

      const target = e.target as HTMLElement | null;
      // Ignore interactive elements, sliders, textareas, maps, horizontal carousels
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
        // Dynamic finger drag with fluid resistance
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
      // Discard if gesture was cancelled or if route changed during touch (e.g. native edge back popped)
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

          setTimeout(() => {
            if (nextRoute && nextRoute !== pathname) {
              router.push(nextRoute);
            }
          }, 100);
        } else {
          // Swiped RIGHT -> Previous dock tab
          const prevIndex = (currentIndex - 1 + routes.length) % routes.length;
          const prevRoute = routes[prevIndex];

          setTimeout(() => {
            if (prevRoute && prevRoute !== pathname) {
              router.push(prevRoute);
            }
          }, 100);
        }
      } else {
        // Snap back to neutral morph position
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

  // Calculate fluid morph variables: scale morph, blur morph, and gentle parallax
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 400;
  const dragFraction = Math.min(1, Math.abs(dragOffset) / windowWidth);

  // When morph entering: starts slightly scaled down (0.975) and blurred (2.5px), smoothly expanding into full view
  const currentScale = isMorphEntering ? 0.985 : Math.max(0.97, 1 - dragFraction * 0.05);
  const currentBlur = isMorphEntering ? 2 : Math.min(3, dragFraction * 6);
  const currentOpacity = isMorphEntering ? 0.8 : Math.max(0.7, 1 - dragFraction * 0.4);
  const currentTranslateX = dragOffset * 0.35; // Gentle subtle parallax shift, not abrupt bounce

  return (
    <div 
      className="w-full relative will-change-transform"
      style={{
        transform: `translate3d(${currentTranslateX}px, 0, 0) scale(${currentScale})`,
        opacity: currentOpacity,
        filter: currentBlur > 0.2 ? `blur(${currentBlur.toFixed(1)}px)` : "none",
        transition: isAnimating 
          ? "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 220ms ease" 
          : "none",
      }}
    >
      {children}
    </div>
  );
}
