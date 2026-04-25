/**
 * Host-agnostic notification port.
 *
 * `designer-ui` modules call `showNotification(options)` without knowing how
 * the host shell presents notifications. The web shell registers a sonner
 * sink, the VS Code extension webview registers a sink that forwards to
 * `vscode.window.show*` via postMessage. Until a sink is registered, calls
 * are silently dropped.
 */

export type NotificationKind = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
  label: string;
  onPress: () => void;
}

export interface NotificationOptions {
  message: string;
  kind?: NotificationKind;
  durationMs?: number;
  action?: NotificationAction;
}

export interface NotificationSink {
  show(options: NotificationOptions): void;
}

const NOOP_SINK: NotificationSink = {
  show: () => undefined,
};

let activeSink: NotificationSink = NOOP_SINK;

/**
 * Register the active notification sink. Called once during shell bootstrap.
 * Subsequent registrations replace the previous sink.
 */
export function registerNotificationSink(sink: NotificationSink): void {
  activeSink = sink;
}

/**
 * Reset the sink back to a no-op. Primarily intended for tests / teardown.
 */
export function resetNotificationSink(): void {
  activeSink = NOOP_SINK;
}

/**
 * Surface a notification through the registered sink. No-op if nothing is
 * registered yet.
 */
export function showNotification(options: NotificationOptions): void {
  activeSink.show(options);
}
