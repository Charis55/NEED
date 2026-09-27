/**
 * useLocalDraft — Persist form data to localStorage and restore on mount.
 * Survives page refreshes and dropped connections.
 *
 * Usage:
 *   const [draft, setDraft, clearDraft] = useLocalDraft("job-request", { description: "", offerAmount: 0 });
 */

import { useState, useEffect, useCallback, useRef } from "react";

const DRAFT_PREFIX = "need_draft_";

export function useLocalDraft<T extends Record<string, any>>(
  key: string,
  defaultValue: T
): [T, (update: Partial<T>) => void, () => void] {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const isInitialized = useRef(false);

  const [draft, setDraftState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with default to handle new fields added after a draft was saved
        return { ...defaultValue, ...parsed };
      }
    } catch {
      // Corrupted data — start fresh
    }
    return defaultValue;
  });

  // Persist to localStorage on every change (debounced by React batching)
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Storage full or unavailable — silently fail
    }
  }, [draft, storageKey]);

  const setDraft = useCallback((update: Partial<T>) => {
    setDraftState((prev) => ({ ...prev, ...update }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState(defaultValue);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [defaultValue, storageKey]);

  return [draft, setDraft, clearDraft];
}
