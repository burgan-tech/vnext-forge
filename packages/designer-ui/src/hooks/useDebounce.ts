import { useEffect, useState } from 'react';

const DEFAULT_DELAY_MS = 300;

export const useDebounce = <T>(value: T, delayMs: number = DEFAULT_DELAY_MS): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return debouncedValue;
};
