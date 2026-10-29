import { auth } from "@/lib/firebase";

/**
 * Client-side fetch helper for Admin operations.
 * Automatically attaches the current user's Firebase ID token to the Authorization header.
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  const headers = new Headers(init?.headers || {});

  if (user) {
    try {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    } catch (e) {
      console.warn("Failed to retrieve admin token for request:", e);
    }
  }

  return fetch(input, {
    ...init,
    headers
  });
}

