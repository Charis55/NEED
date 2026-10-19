import { useSyncExternalStore } from "react";

let cached: string | null = null;

export function readSessionId(): string | null {
  if (typeof window === "undefined") return null;
  if (cached) return cached;
  try {
    let v = window.sessionStorage.getItem("need.sessionId");
    if (!v) {
      v = typeof crypto !== "undefined" && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15);
      window.sessionStorage.setItem("need.sessionId", v);
    }
    cached = v;
  } catch {
    cached = typeof crypto !== "undefined" && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15);
  }
  return cached;
}

const subscribe = () => () => {};

/**
 * Returns null during SSR and the first hydration pass, then the real client session ID.
 * Prevents SSR/hydration divergence and race conditions.
 */
export function useSessionId(): string | null {
  return useSyncExternalStore(subscribe, readSessionId, () => null);
}

/**
 * Synchronous accessor for user-triggered callbacks / event handlers.
 * Never invoke at module scope.
 */
export function getSessionId(): string {
  return readSessionId() || "client-session";
}

/**
 * Backwards compatibility getter (lazy evaluated property)
 */
export const sessionId = typeof window !== "undefined" ? (readSessionId() || "") : "";
