"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

// Global stack for back button handlers
const backButtonHandlers: Array<() => void> = [];

export function useBackButton(handler: () => void, isActive: boolean) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isActive) return;

    backButtonHandlers.push(handler);

    return () => {
      const index = backButtonHandlers.indexOf(handler);
      if (index !== -1) {
        backButtonHandlers.splice(index, 1);
      }
    };
  }, [handler, isActive]);
}

export function getActiveBackHandler() {
  if (backButtonHandlers.length === 0) return null;
  return backButtonHandlers[backButtonHandlers.length - 1];
}
