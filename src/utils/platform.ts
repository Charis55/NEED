import { Capacitor } from "@capacitor/core";

/**
 * Checks if the app is running in a native wrapper (Android Capacitor or iOS WKWebView xtool app)
 */
export const isNativeApp = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    Capacitor.isNativePlatform() ||
    (window as any).webkit?.messageHandlers?.needNative !== undefined ||
    navigator.userAgent.includes("NeedApp")
  );
};

/**
 * Checks if running specifically inside the iOS native wrapper
 */
export const isIOSNativeApp = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    (window as any).webkit?.messageHandlers?.needNative !== undefined ||
    (/iPhone|iPad|iPod/i.test(navigator.userAgent) && isNativeApp())
  );
};

/**
 * Sends messages to the native iOS container bridge (needNative)
 */
export const notifyIOSNative = (action: string, payload?: Record<string, any>) => {
  if (typeof window === "undefined") return;
  try {
    const webkit = (window as any).webkit;
    if (webkit?.messageHandlers?.needNative) {
      webkit.messageHandlers.needNative.postMessage({
        action,
        ...payload
      });
    }
  } catch (e) {
    console.warn("notifyIOSNative bridge failed:", e);
  }
};
