import { useCallback, useEffect, useRef } from "preact/hooks";

// Debounces writes to sessionStorage under a fixed key prefix (e.g. "timestamp-").
// Each logical key (e.g. "input", "output") gets its own pending timeout, so
// acting on one key never cancels or drops a pending write for another key.
export const useDebouncedSessionStorage = (prefix: string, delay: number) => {
  const pendingRef = useRef(new Map<string, { timeout: number; value: string }>());

  const write = useCallback(
    (key: string, value: string) => {
      sessionStorage.setItem(`${prefix}${key}`, value);
    },
    [prefix],
  );

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const [key, { timeout, value }] of pending) {
        clearTimeout(timeout);
        write(key, value);
      }
      pending.clear();
    };
  }, [write]);

  const load = useCallback(
    (key: string): string | null => sessionStorage.getItem(`${prefix}${key}`),
    [prefix],
  );

  const save = useCallback(
    (key: string, value: string) => {
      const existing = pendingRef.current.get(key);
      if (existing) {
        clearTimeout(existing.timeout);
      }
      const timeout = window.setTimeout(() => {
        pendingRef.current.delete(key);
        write(key, value);
      }, delay);
      pendingRef.current.set(key, { timeout, value });
    },
    [delay, write],
  );

  const saveNow = useCallback(
    (key: string, value: string) => {
      const existing = pendingRef.current.get(key);
      if (existing) {
        clearTimeout(existing.timeout);
        pendingRef.current.delete(key);
      }
      write(key, value);
    },
    [write],
  );

  return { load, save, saveNow };
};
