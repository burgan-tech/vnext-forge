import { useCallback, useEffect, useRef } from 'react';

import { APP_CONFIG } from '@shared/config/config';
import { createLogger } from '@shared/lib/logger/createLogger';

const logger = createLogger('useRuntimeRevalidator');

export interface RuntimeRevalidatorOptions {
  minIntervalSeconds?: number;
  backgroundIntervalSeconds?: number | null;
  revalidateOnMount?: boolean;
  runInBackground?: boolean;
}

const DEFAULT_MIN_INTERVAL_SECONDS = APP_CONFIG.RUNTIME_REVALIDATION_MIN_INTERVAL_SECONDS;

export const useRuntimeRevalidator = (
  onRevalidate: () => void | Promise<void>,
  options?: RuntimeRevalidatorOptions,
): void => {
  const minIntervalSeconds = options?.minIntervalSeconds ?? DEFAULT_MIN_INTERVAL_SECONDS;
  const backgroundIntervalSeconds = options?.backgroundIntervalSeconds ?? null;
  const revalidateOnMount = options?.revalidateOnMount ?? true;
  const runInBackground = options?.runInBackground ?? false;
  const minIntervalMs = minIntervalSeconds * 1000;
  const backgroundIntervalMs =
    backgroundIntervalSeconds === null ? null : backgroundIntervalSeconds * 1000;

  const callbackRef = useRef(onRevalidate);
  const lastExecutionRef = useRef(0);

  useEffect(() => {
    callbackRef.current = onRevalidate;
  }, [onRevalidate]);

  const runRevalidate = useCallback(
    (force = false) => {
      const now = Date.now();
      const elapsed = now - lastExecutionRef.current;

      if (!force && elapsed < minIntervalMs) {
        return;
      }

      lastExecutionRef.current = now;

      void Promise.resolve(callbackRef.current()).catch((error: unknown) => {
        logger.error('Runtime revalidation failed', error);
      });
    },
    [minIntervalMs],
  );

  useEffect(() => {
    if (revalidateOnMount) {
      runRevalidate(true);
    }
  }, [revalidateOnMount, runRevalidate]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        runRevalidate();
      }
    };

    const handleFocus = () => {
      runRevalidate();
    };

    const handleOnline = () => {
      runRevalidate(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [runRevalidate]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      backgroundIntervalMs === null ||
      backgroundIntervalMs <= 0
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!runInBackground && document.hidden) {
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      runRevalidate(true);
    }, backgroundIntervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [backgroundIntervalMs, runInBackground, runRevalidate]);
};
