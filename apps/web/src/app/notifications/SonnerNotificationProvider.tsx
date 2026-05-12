import { useEffect, type ReactNode } from 'react';
import { toast, type ExternalToast } from 'sonner';

import {
  registerNotificationSink,
  resetNotificationSink,
  type NotificationKind,
  type NotificationOptions,
  type NotificationSink,
} from '@vnext-forge-studio/designer-ui';

import { Toaster } from './Sonner';

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

/**
 * Web-shell notification host. Renders the sonner `<Toaster />` and registers
 * the matching {@link NotificationSink}. Mount once near the top of the
 * provider tree; designer-ui modules will then route every
 * `showNotification(...)` call through sonner.
 */
export function SonnerNotificationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerNotificationSink(sonnerSink);
    return () => {
      resetNotificationSink();
    };
  }, []);

  return (
    <>
      {children}
      {/*
       * `richColors` makes Sonner paint each kind in its native vibrant
       * palette (red error, green success, amber warning, blue info)
       * instead of a uniform muted toast — so the user can tell at a
       * glance whether a save failed or succeeded.
       *
       * `closeButton` adds an `x` so persistent errors don't have to
       * wait for the auto-dismiss timer.
       *
       * The VS Code extension shell renders these through
       * `vscode.window.showErrorMessage / showWarningMessage /
       * showInformationMessage` — native VS Code notifications already
       * differentiate kinds by icon + color, so no parallel option
       * needed there.
       */}
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
