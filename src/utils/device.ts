import { Capacitor } from "@capacitor/core";

export type PlatformName = "ios" | "android" | "web";

let inMemoryDeviceId: string | null = null;
let inMemoryActiveOutgoingCallId: string | null = null;

/**
 * Safe session storage helpers that never throw in private browsing, WKWebView, or SSR.
 */
export function safeGetSession(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetSession(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore quota or security restrictions
  }
}

export function safeRemoveSession(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore restrictions
  }
}

/**
 * In-memory active outgoing call token manager.
 * Guarantees caller isolation: only the specific JS runtime that initiated
 * the call knows the unique attempt/call token.
 */
export function setActiveOutgoingCallId(callId: string | null): void {
  inMemoryActiveOutgoingCallId = callId;
  if (typeof window !== "undefined") {
    if (callId) {
      safeSetSession("need_active_outgoing_call_id", callId);
    } else {
      safeRemoveSession("need_active_outgoing_call_id");
    }
  }
}

export function getActiveOutgoingCallId(): string | null {
  if (inMemoryActiveOutgoingCallId) return inMemoryActiveOutgoingCallId;
  return safeGetSession("need_active_outgoing_call_id");
}

export function clearActiveOutgoingCallId(): void {
  inMemoryActiveOutgoingCallId = null;
  safeRemoveSession("need_active_outgoing_call_id");
}

/**
 * Generate a cryptographically unique call attempt ID.
 */
export function generateCallAttemptId(jobId: string): string {
  const platform = getPlatformName();
  const rand = Math.random().toString(36).substring(2, 7);
  return `call_${jobId}_${Date.now()}_${platform}_${rand}`;
}

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
 * Unique, persistent device identifier stored in memory, localStorage, and cookie.
 * Every physical device or browser profile gets a unique ID with platform prefix.
 * Cached in memory so repeated calls in the same session NEVER return different values.
 * e.g. "ios_a1b2c3d4", "web_e5f6g7h8", "android_9i0j1k2l"
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  if (inMemoryDeviceId) return inMemoryDeviceId;

  const platform = getPlatformName();

  // 1. Try reading from localStorage
  try {
    const localId = localStorage.getItem("need.deviceId");
    if (localId && localId.trim()) {
      inMemoryDeviceId = localId.trim();
      return inMemoryDeviceId;
    }
  } catch {
    // localStorage restricted / unavailable
  }

  // 2. Try reading from cookie fallback
  try {
    if (typeof document !== "undefined" && document.cookie) {
      const match = document.cookie.match(/(?:^|;\s*)need_device_id=([^;]+)/);
      if (match && match[1]) {
        inMemoryDeviceId = decodeURIComponent(match[1]);
        return inMemoryDeviceId;
      }
    }
  } catch {
    // Cookie restricted / unavailable
  }

  // 3. Generate a new stable ID
  const rand = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
  const newId = `${platform}_${rand}`;
  inMemoryDeviceId = newId;

  // Persist to localStorage if permitted
  try {
    localStorage.setItem("need.deviceId", newId);
  } catch {
    // Ignore
  }

  // Persist to document cookie if permitted (1-year lifetime)
  try {
    if (typeof document !== "undefined") {
      document.cookie = `need_device_id=${encodeURIComponent(newId)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {
    // Ignore
  }

  return inMemoryDeviceId;
}

/**
 * Sends a message across the WKScriptMessageHandler bridge to native iOS Swift.
 * Supports actions: "startCall", "endCall", "reportIncomingCall", "setAudioMode", "haptic".
 */
export function notifyNativeCall(action: string, payload?: Record<string, any>): void {
  if (typeof window === "undefined") return;
  try {
    const webkit = (window as any).webkit;
    if (webkit?.messageHandlers?.needNative) {
      webkit.messageHandlers.needNative.postMessage({
        action,
        ...payload,
      });
    }
  } catch (e) {
    console.warn("notifyNativeCall failed:", e);
  }
}

