import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  dismissNotification,
  nextNotification,
  useNotificationStore,
} from '../model/notificationStore.js';
import { createLogger } from '../../lib/logger/createLogger.js';
import { Toaster } from '../../ui/Sonner.js';

const logger = createLogger('NotificationContainer');

export const NotificationContainer = () => {
  const current = useNotificationStore((state) => state.current);
  const visible = useNotificationStore((state) => state.visible);
  const queueLength = useNotificationStore((state) => state.queue.length);
  const lastShownNotificationIdRef = useRef<number | null>(null);

  const handleDismiss = useCallback(() => {
    dismissNotification();

    if (current) {
      logger.debug('Dismiss notification', current);
    }
  }, [current]);

  useEffect(() => {
    if (!current && queueLength > 0) {
      const timer = window.setTimeout(() => {
        nextNotification();
      }, 250);

      return () => window.clearTimeout(timer);
    }
  }, [current, queueLength]);

  useEffect(() => {
    if (!current?.message || !visible) {
      return;
    }

    if (lastShownNotificationIdRef.current === current.id) {
      return;
    }

    lastShownNotificationIdRef.current = current.id ?? null;

    const toastOptions = {
      id: current.id,
      duration: current.duration ?? 2000,
      onAutoClose: handleDismiss,
      action:
        current.actionLabel && current.onActionPress
          ? {
              label: current.actionLabel,
              onClick: () => {
                current.onActionPress?.();
              },
            }
          : undefined,
    };

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
  }, [current, handleDismiss, visible]);

  return <Toaster position="bottom-center" />;
};
