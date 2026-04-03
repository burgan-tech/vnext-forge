import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast, Toaster, type ToastT } from 'sonner';
import {
  dismissNotification,
  nextNotification,
  type NotificationOptions,
} from '@shared/notification/model/notificationSlice';
import { createLogger } from '@shared/lib/logger/createLogger';

const logger = createLogger('NotificationContainer');

interface NotificationStoreState {
  notification: {
    current: NotificationOptions | null;
    visible: boolean;
    queue: NotificationOptions[];
  };
}

export const NotificationContainer = () => {
  const dispatch = useDispatch();
  const { current, visible, queue } = useSelector(
    (state: NotificationStoreState) => state.notification,
  );

  const handleDismiss = useCallback(() => {
    dispatch(dismissNotification());
    logger.debug('Dismiss notification', current);
  }, [current, dispatch]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const timer = window.setTimeout(() => {
        dispatch(nextNotification());
      }, 250);

      return () => window.clearTimeout(timer);
    }
  }, [current, queue.length, dispatch]);

  useEffect(() => {
    if (current?.message && visible) {
      const toastOptions: ToastT = {
        id: current.id ?? '',
        duration: current.duration ?? 2000,
        onAutoClose: handleDismiss,
      };

      if (current.actionLabel && current.onActionPress) {
        toastOptions.action = {
          label: current.actionLabel,
          onClick: () => {
            current.onActionPress?.();
          },
        };
      }

      switch (current.type) {
        case 'success':
          toast.success(current.message, toastOptions);
          break;
        case 'error':
          toast.error(current.message, toastOptions);
          break;
        case 'info':
        default:
          toast.info(current.message, toastOptions);
          break;
      }
    }
  }, [current, handleDismiss, visible]);

  return <Toaster position="bottom-center" />;
};
