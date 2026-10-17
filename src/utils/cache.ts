/**
 * src/utils/cache.ts
 *
 * Lightweight, high-performance in-memory and on-device storage cache.
 * Accelerates app cold starts and screen switches (profiles, chat listings, service metadata).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export function cacheGet<T>(key: string): T | null {
  const now = Date.now();

  // 1. Check memory cache first (< 1ms)
  const mem = memoryCache.get(key);
  if (mem) {
    if (mem.expiresAt > now) {
      return mem.value as T;
    }
    memoryCache.delete(key);
  }

  // 2. Fall back to on-device localStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`need_cache_${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        if (parsed.expiresAt > now) {
          memoryCache.set(key, parsed);
          return parsed.value;
        }
        localStorage.removeItem(`need_cache_${key}`);
      }
    } catch (e) {
      // Storage access or parse error
    }
  }

  return null;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number = 1000 * 60 * 30): void {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  memoryCache.set(key, entry);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`need_cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      // Quota exceeded or private browsing
    }
  }
}

export function cacheRemove(key: string): void {
  memoryCache.delete(key);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`need_cache_${key}`);
    } catch (e) {}
  }
}
