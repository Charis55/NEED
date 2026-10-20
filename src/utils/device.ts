import { Capacitor } from "@capacitor/core";

export type PlatformName = "ios" | "android" | "web";

/**
 * Detect the platform Need is currently executing in:
 * - "ios": Native iOS app (Swift WKWebView / Capacitor)
 * - "android": Native Android app (Capacitor)
 * - "web": Standard web browser (desktop, laptop, mobile web)
 */
export function getPlatformName(): PlatformName {
  if (typeof window === "undefined") return "web";
  
  // Native iOS WKWebView container check
  if ((window as any).webkit?.messageHandlers?.needNative) {
    return "ios";
  }

  // Capacitor runtime platform
  if (Capacitor.isNativePlatform()) {
    const p = Capacitor.getPlatform();
    if (p === "ios") return "ios";
    if (p === "android") return "android";
  }

  // User-Agent fallback
  const ua = typeof navigator !== "undefined" && navigator.userAgent ? navigator.userAgent : "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";

  return "web";
}

/**
 * Returns true ONLY if running in native mobile environment (iOS or Android).
 * Web browsers on desktop/laptop/mobile return false because Web does not have
 * hardware access to the discrete earpiece speaker.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    Capacitor.isNativePlatform() ||
    Boolean((window as any).webkit?.messageHandlers?.needNative)
  );
}

/**
 * Unique, persistent device identifier stored in localStorage.
 * Every physical device or browser profile gets a unique ID with platform prefix.
 * e.g. "ios_a1b2c3d4", "web_e5f6g7h8", "android_9i0j1k2l"
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem("need.deviceId");
    if (!id) {
      const platform = getPlatformName();
      const rand = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      id = `${platform}_${rand}`;
      localStorage.setItem("need.deviceId", id);
    }
    return id;
  } catch {
    return `fallback_${Math.random().toString(36).substring(2, 12)}`;
  }
}
