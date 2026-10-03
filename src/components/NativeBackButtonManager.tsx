"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getActiveBackHandler } from "@/hooks/useBackButton";

export default function NativeBackButtonManager() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener("backButton", ({ canGoBack }) => {
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

  return null;
}
