"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

interface DockSwipeNavigatorProps {
  routes: string[];
}

export default function DockSwipeNavigator({ routes }: DockSwipeNavigatorProps) {
  const pathname = usePathname();
  const router = useRouter();

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  // Prefetch adjacent dock routes on mount and when route changes for instant transitions
  useEffect(() => {
    routes.forEach((route) => {
      try {
        router.prefetch(route);
      } catch (e) {
        // ignore prefetch errors
      }
    });
  }, [routes, router]);

  useEffect(() => {
    // Constraint 2: Strictly only enable swipe on screens that are exact dock routes!
    const isDockRoute = routes.includes(pathname);
    if (!isDockRoute) {
      return;
    }

    const currentIndex = routes.indexOf(pathname);
    if (currentIndex === -1) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only track single-finger touches
      if (e.touches.length !== 1) return;

      const target = e.target as HTMLElement | null;
      // Never hijack interaction on sliders, maps, form controls, horizontal carousels, or designated no-swipe zones
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
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startXRef.current === null || startYRef.current === null) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startXRef.current;
      const diffY = currentY - startYRef.current;

      // Determine intent on initial movement (> 10px)
      if (isHorizontalSwipeRef.current === null) {
        const absX = Math.abs(diffX);
        const absY = Math.abs(diffY);
        if (absX > 10 || absY > 10) {
          // If predominantly horizontal, mark as horizontal swipe
          isHorizontalSwipeRef.current = absX > absY * 1.2;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (
        startXRef.current === null ||
        startYRef.current === null ||
        !isHorizontalSwipeRef.current
      ) {
        startXRef.current = null;
        startYRef.current = null;
        isHorizontalSwipeRef.current = null;
        return;
      }

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startXRef.current;
      const diffY = endY - startYRef.current;
      const elapsed = Date.now() - startTimeRef.current;

      startXRef.current = null;
      startYRef.current = null;
      isHorizontalSwipeRef.current = null;

      // Fast, deliberate swipe gesture:
      // Minimum distance: 50px, Max elapsed time: 650ms, Predominantly horizontal
      if (Math.abs(diffX) >= 50 && elapsed < 650 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
        if (diffX < 0) {
          // Swiped LEFT: Dragging content left to reveal the NEXT dock screen to the right
          // Constraint 1: Infinite loop (wraps from last screen back to first)
          const nextIndex = (currentIndex + 1) % routes.length;
          const nextRoute = routes[nextIndex];
          if (nextRoute && nextRoute !== pathname) {
            router.push(nextRoute);
          }
        } else {
          // Swiped RIGHT: Dragging content right to reveal the PREVIOUS dock screen to the left
          // Constraint 1: Infinite loop (wraps from first screen back to last)
          const prevIndex = (currentIndex - 1 + routes.length) % routes.length;
          const prevRoute = routes[prevIndex];
          if (prevRoute && prevRoute !== pathname) {
            router.push(prevRoute);
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
  }, [pathname, routes, router]);

  return null;
}
