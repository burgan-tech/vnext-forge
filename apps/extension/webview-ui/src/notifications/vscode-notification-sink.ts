import type {
  NotificationKind,
  NotificationSink,
} from '@vnext-forge-studio/designer-ui';

import type { VsCodeWebviewApi } from '../VsCodeTransport';

/**
 * Frame envelope sent from the webview to the extension host whenever
 * `showNotification(...)` is called inside designer-ui modules. The host
 * MessageRouter routes these to `vscode.window.show*Message` so the user
 * sees a native VS Code notification instead of a webview-only toast.
 */
export interface HostNotifyFrame {
  type: 'host:notify';
  kind: NotificationKind;
  message: string;
  /** Optional action label. If present, the host will surface a button. */
  actionLabel?: string;
  /** Correlation id so the host can route action callbacks back. */
  actionId?: string;
}

/** Reply sent back from the host when the user clicks the action button. */
export interface HostNotifyActionReply {
  type: 'host:notify:action';
  actionId: string;
}

interface PendingAction {
  onPress: () => void;
}

/**
 * Build a {@link NotificationSink} that forwards every notification to the
 * VS Code extension host via `postMessage`. Action callbacks are correlated
 * back through an `actionId` map so the original `onPress` can fire when
 * the user clicks the button in the native VS Code notification.
 */
export function createVsCodeNotificationSink(api: VsCodeWebviewApi): NotificationSink {
  const pendingActions = new Map<string, PendingAction>();

  window.addEventListener('message', (event) => {
    const data = event.data as unknown;
    if (!isActionReply(data)) return;
    const entry = pendingActions.get(data.actionId);
    if (!entry) return;
    pendingActions.delete(data.actionId);
    try {
      entry.onPress();
    } catch {
      // Action callbacks are best-effort; swallow to avoid breaking message loop.
    }
  });

  return {
    show(options) {
      const frame: HostNotifyFrame = {
        type: 'host:notify',
        kind: options.kind ?? 'info',
        message: options.message,
      };

      if (options.action) {
        const actionId = generateActionId();
        pendingActions.set(actionId, { onPress: options.action.onPress });
        frame.actionLabel = options.action.label;
        frame.actionId = actionId;
      }

      api.postMessage(frame);
    },
  };
}

function isActionReply(value: unknown): value is HostNotifyActionReply {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'host:notify:action' &&
    typeof (value as { actionId?: unknown }).actionId === 'string'
  );
}

function generateActionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `notify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
