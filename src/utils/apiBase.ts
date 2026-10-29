import { auth } from "@/lib/firebase";

/**
 * API Base URL Resolver for Web and Capacitor Native Android/iOS
 * Ensures API requests from Capacitor native apps reach the production Next.js backend
 * instead of trying to fetch from the local asset origin (localhost).
 */

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const origin = window.location.origin || "";
    const isCapacitor = Boolean(
      (window as any).Capacitor?.isNativePlatform?.() ||
      origin.includes("capacitor://") ||
      origin === "http://localhost" ||
      origin === "https://localhost"
    );
    if (isCapacitor) {
      return process.env.NEXT_PUBLIC_APP_URL || "https://need-chi.vercel.app";
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL || "";
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init?.headers || {});

  // Automatically attach Firebase ID Token for authenticated requests if not already set
  if (!headers.has("Authorization") && !headers.has("authorization")) {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        headers.set("Authorization", `Bearer ${idToken}`);
      } catch (err) {
        console.warn("apiFetch: Failed to attach auth ID token", err);
      }
    }
  }

  return fetch(url, {
    ...init,
    headers
  });
}

export async function safeJsonParse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim() === "") {
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    if (!res.ok) {
      throw new Error(`Server returned error ${res.status}: ${text.slice(0, 120)}`);
    }
    throw new Error(`Invalid response from server: ${text.slice(0, 120)}`);
  }
}
