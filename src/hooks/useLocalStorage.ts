import { useCallback, useEffect, useRef, useState } from 'react';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(key: string, initial: T) {
  const mounted = useRef(false);
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      return safeParse<T>(window.localStorage.getItem(key), initial);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {}
        return resolved;
      });
    },
    [key],
  );

  const readRaw = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const writeRaw = useCallback(
    (raw: string) => {
      try {
        window.localStorage.setItem(key, raw);
        if (mounted.current) setValue(safeParse<T>(raw, initial));
        return true;
      } catch {
        return false;
      }
    },
    [initial, key],
  );

  return { value, set, readRaw, writeRaw } as const;
}

