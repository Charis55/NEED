/**
 * API Base URL Resolver for Web and Capacitor Native Android/iOS
 * Ensures API requests from Capacitor native apps reach the production Next.js backend
 * instead of trying to fetch from the local asset origin (localhost).
 */

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const origin = window.location.origin || "";
    const isCapacitor = origin.includes("localhost") || 
                        origin.includes("capacitor://") ||
                        (window as any).Capacitor?.isNativePlatform?.();
    if (isCapacitor) {
      return process.env.NEXT_PUBLIC_APP_URL || "https://need-chi.vercel.app";
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL || "";
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  return fetch(url, init);
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
