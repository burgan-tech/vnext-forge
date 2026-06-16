import { useEffect, type ReactNode } from 'react';
import { toast, Toaster, type ExternalToast } from 'sonner';

import {
  registerNotificationSink,
  resetNotificationSink,
  type NotificationKind,
  type NotificationOptions,
  type NotificationSink,
} from '@vnext-forge-studio/designer-ui/notification';

const DEFAULT_DURATION_MS = 3000;

const sonnerSink: NotificationSink = {
  show(options: NotificationOptions) {
    const opts: ExternalToast = {
      duration: options.durationMs ?? DEFAULT_DURATION_MS,
    };

    if (options.action) {
      opts.action = {
        label: options.action.label,
        onClick: options.action.onPress,
      };
    }

    dispatch(options.kind, options.message, opts);
  },
};

function dispatch(kind: NotificationKind | undefined, message: string, opts: ExternalToast) {
  switch (kind) {
    case 'success':
      toast.success(message, opts);
      return;
    case 'warning':
      toast.warning(message, opts);
      return;
    case 'error':
      toast.error(message, opts);
      return;
    case 'info':
    default:
      toast.info(message, opts);
      return;
  }
}

export function SonnerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerNotificationSink(sonnerSink);
    return () => {
      resetNotificationSink();
    };
  }, []);

  return (
    <>
      {children}
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
