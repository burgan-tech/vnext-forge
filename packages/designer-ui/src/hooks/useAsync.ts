import { useCallback, useRef, useState } from 'react';
import {
  getErrorPresentation,
  isFailure,
  type ApiResponse,
  type ErrorSeverity,
  VnextForgeError,
} from '@vnext-forge-studio/app-contracts';
import { toVnextError } from '../lib/error/vNextErrorHelpers.js';
import { showNotification, type NotificationKind } from '../notification/notification-port.js';
import { createLogger } from '../lib/logger/createLogger.js';

const logger = createLogger('useAsync');

export interface UseAsyncOptions<T> {
  onSuccess?: (result: ApiResponse<T>) => void | Promise<void>;
  onError?: (error: VnextForgeError) => void | Promise<void>;
  showNotificationOnError?: boolean;
  showNotificationOnSuccess?: boolean;
  successMessage?: string;
  errorMessage?: string;
  notificationKind?: NotificationKind;
  successNotificationKind?: NotificationKind;
  errorNotificationKind?: NotificationKind;
  notificationDurationMs?: number;
}

type AsyncFunction<T, TArgs extends unknown[]> = (...args: TArgs) => Promise<ApiResponse<T>>;

/**
 * Translate the typed `ErrorSeverity` from `error-presentation.ts` into a
 * `NotificationKind` understood by the notification port. They almost
 * align 1:1; the only mismatch is `'error'` which maps to the host's
 * red toast.
 */
function severityToNotificationKind(severity: ErrorSeverity): NotificationKind {
  switch (severity) {
    case 'info':
      return 'info';
    case 'warning':
      return 'warning';
    case 'error':
    default:
      return 'error';
  }
}

export function useAsync<T, TArgs extends unknown[]>(
  asyncFunction: AsyncFunction<T, TArgs>,
  options?: UseAsyncOptions<T>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<VnextForgeError | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [success, setSuccess] = useState(false);

  const lastArgsRef = useRef<TArgs | null>(null);
  const isExecutingRef = useRef(false);
  const asyncFunctionRef = useRef(asyncFunction);
  const optionsRef = useRef(options);

  asyncFunctionRef.current = asyncFunction;
  optionsRef.current = options;

  const execute = useCallback(async (...args: TArgs): Promise<void> => {
    if (isExecutingRef.current) {
      logger.debug('Async operation ignored because another execution is in progress.');
      return;
    }

    isExecutingRef.current = true;
    setLoading(true);
    lastArgsRef.current = args;
    setError(null);
    setSuccess(false);

    const currentOptions = optionsRef.current;

    try {
      const result = await asyncFunctionRef.current(...args);

      if (isFailure(result)) {
        throw result;
      }

      setData(result.data);
      setSuccess(true);

      // `onSuccess` / bildirim: tamamlanma anındaki seçenekler (stale closure önlemi).
      const successOptions = optionsRef.current;
      await successOptions?.onSuccess?.(result);

      if (successOptions?.showNotificationOnSuccess && successOptions.successMessage) {
        showNotification({
          message: successOptions.successMessage,
          kind:
            successOptions.successNotificationKind ??
            successOptions.notificationKind ??
            'success',
          durationMs: successOptions.notificationDurationMs ?? 3000,
        });
      }
    } catch (value) {
      const error = toVnextError(value, currentOptions?.errorMessage);
      logger.error('Async operation failed', error);

      setError(error);
      setSuccess(false);

      if (currentOptions?.showNotificationOnError !== false) {
        // Pick the toast kind from the per-code presentation map so that
        // expected operational states (e.g. runtime offline) surface as
        // a yellow warning instead of a red error. Caller overrides
        // (`errorNotificationKind` / `notificationKind`) still win.
        const presentation = getErrorPresentation(error.code);
        showNotification({
          message: error.toUserMessage().message,
          kind:
            currentOptions?.errorNotificationKind ??
            currentOptions?.notificationKind ??
            severityToNotificationKind(presentation.severity),
          durationMs: currentOptions?.notificationDurationMs ?? 3000,
        });
      }

      try {
        await currentOptions?.onError?.(error);
      } catch (callbackError) {
        logger.error('onError callback execution failed', callbackError);
      }
    } finally {
      isExecutingRef.current = false;
      setLoading(false);
    }
  }, []);

  const retry = useCallback(async (): Promise<void> => {
    if (lastArgsRef.current) {
      await execute(...lastArgsRef.current);
    }
  }, [execute]);

  const reset = useCallback(() => {
    isExecutingRef.current = false;
    lastArgsRef.current = null;
    setData(null);
    setLoading(false);
    setError(null);
    setSuccess(false);
  }, []);

  return { execute, retry, reset, loading, error, data, success };
}
