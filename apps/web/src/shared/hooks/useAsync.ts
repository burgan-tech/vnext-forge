import { useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  showNotification,
  type NotificationModalType,
  type NotificationType,
} from '@shared/notification/model/notificationSlice';
import { toApplicationError, type ApplicationError } from '@shared/lib/errors/appError';
import type { ApiResponse } from '@shared/types/api';
import { createLogger } from '@shared/lib/logger/createLogger';

const logger = createLogger('useAsync');

interface UseAsyncOptions<T> {
  onSuccess?: (result: ApiResponse<T>) => void | Promise<void>;
  onError?: (error: ApplicationError) => void | Promise<void>;
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
  const [error, setError] = useState<ApplicationError | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [success, setSuccess] = useState(false);

  const lastArgsRef = useRef<TArgs | null>(null);
  const isExecutingRef = useRef(false);
  const asyncFunctionRef = useRef(asyncFunction);
  const optionsRef = useRef(options);

  asyncFunctionRef.current = asyncFunction;
  optionsRef.current = options;
  const dispatch = useDispatch();

  const execute = useCallback(
    async (...args: TArgs): Promise<void> => {
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

        setData(result.data);
        setSuccess(true);

        await currentOptions?.onSuccess?.(result);

        if (currentOptions?.showNotificationOnSuccess && currentOptions.successMessage) {
          dispatch(
            showNotification({
              message: currentOptions.successMessage,
              type:
                currentOptions.successNotificationType ??
                currentOptions.notificationType ??
                'success',
              modalType: currentOptions.modalType ?? 'toast',
              duration: currentOptions.duration ?? 3000,
            }),
          );
        }
      } catch (value) {
        // apiClient rejects normalized failures. This hook owns the UI-side handling.
        const applicationError = toApplicationError(value, currentOptions?.errorMessage);
        logger.error('Async operation failed', applicationError.toJSON());

        setError(applicationError);
        setSuccess(false);

        if (currentOptions?.showNotificationOnError !== false) {
          dispatch(
            showNotification({
              message: applicationError.message,
              type:
                currentOptions?.errorNotificationType ??
                currentOptions?.notificationType ??
                'error',
              modalType: currentOptions?.modalType ?? 'toast',
              duration: currentOptions?.duration ?? 3000,
            }),
          );
        }

        try {
          await currentOptions?.onError?.(applicationError);
        } catch (callbackError) {
          logger.error('onError callback execution failed', callbackError);
        }
      } finally {
        isExecutingRef.current = false;
        setLoading(false);
      }
    },
    [dispatch],
  );

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
