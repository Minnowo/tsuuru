import { useCallback, useEffect, useRef } from "preact/hooks";

export const useDebouncedCallback = <Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timeoutRef = useRef<number>();
  const pendingArgsRef = useRef<Args>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined && pendingArgsRef.current) {
        clearTimeout(timeoutRef.current);
        callbackRef.current(...pendingArgsRef.current);
      }
    };
  }, []);

  const debounced = useCallback(
    (...args: Args) => {
      clearTimeout(timeoutRef.current);
      pendingArgsRef.current = args;
      timeoutRef.current = window.setTimeout(() => {
        pendingArgsRef.current = undefined;
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );

  const immediate = useCallback((...args: Args) => {
    clearTimeout(timeoutRef.current);
    pendingArgsRef.current = undefined;
    callbackRef.current(...args);
  }, []);

  return [debounced, immediate] as const;
};
