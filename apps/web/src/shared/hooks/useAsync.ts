import { useCallback, useRef, useState } from 'react';
import { isFailure, type ApiResponse, VnextForgeError } from '@vnext-forge/app-contracts';
import { toVnextError } from '@shared/lib/error/vNextErrorHelpers';
import {
  showNotification,
  type NotificationModalType,
  type NotificationType,
} from '@shared/notification/model/NotificationStore';
import { createLogger } from '@shared/lib/logger/CreateLogger';

const logger = createLogger('useAsync');

interface UseAsyncOptions<T> {
  onSuccess?: (result: ApiResponse<T>) => void | Promise<void>;
  onError?: (error: VnextForgeError) => void | Promise<void>;
  showNotificationOnError?: boolean;
  showNotificationOnSuccess?: boolean;
  successMessage?: string;
  errorMessage?: string;
  notificationType?: NotificationType;
  successNotificationType?: NotificationType;
  errorNotificationType?: NotificationType;
  modalType?: NotificationModalType;
  duration?: number;
}

type AsyncFunction<T, TArgs extends unknown[]> = (...args: TArgs) => Promise<ApiResponse<T>>;

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

      await currentOptions?.onSuccess?.(result);

      if (currentOptions?.showNotificationOnSuccess && currentOptions.successMessage) {
        showNotification({
          message: currentOptions.successMessage,
          type:
            currentOptions.successNotificationType ?? currentOptions.notificationType ?? 'success',
          modalType: currentOptions.modalType ?? 'toast',
          duration: currentOptions.duration ?? 3000,
        });
      }
    } catch (value) {
      const error = toVnextError(value, currentOptions?.errorMessage);
      logger.error('Async operation failed', error);

      setError(error);
      setSuccess(false);

      if (currentOptions?.showNotificationOnError !== false) {
        showNotification({
          message: error.toUserMessage().message,
          type:
            currentOptions?.errorNotificationType ?? currentOptions?.notificationType ?? 'error',
          modalType: currentOptions?.modalType ?? 'toast',
          duration: currentOptions?.duration ?? 3000,
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
