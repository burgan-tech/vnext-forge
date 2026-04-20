import type { ReactNode } from 'react';
import { setApiTransport, type ApiTransport } from '../api/transport.js';

export interface DesignerUiProviderProps {
  /**
   * Platform-specific API transport. The host shell (apps/web SPA or
   * apps/extension webview) constructs this and passes it down so designer-ui
   * modules can call `callApi()` / `unwrapApi()` without knowing about HTTP,
   * postMessage, etc.
   */
  transport: ApiTransport;
  children: ReactNode;
}

/**
 * Top-level provider for designer-ui. Registers the active ApiTransport for
 * the lifetime of the host shell. Wrap the entire designer-ui consumer tree
 * (router, modules, pages) with this provider.
 *
 * Notifications are shell-specific: each host registers its own
 * {@link import('../notification/notification-port.js').NotificationSink}
 * (sonner toaster on web, `vscode.window.show*` bridge in the extension)
 * outside of this provider.
 *
 * @example
 * // apps/web (SPA shell)
 * <DesignerUiProvider transport={httpTransport}>
 *   <SonnerNotificationProvider>
 *     <AppRouter />
 *   </SonnerNotificationProvider>
 * </DesignerUiProvider>
 *
 * @example
 * // apps/extension webview
 * registerNotificationSink(vscodeNotificationSink);
 * <DesignerUiProvider transport={vsCodeTransport}>
 *   <DesignerApp />
 * </DesignerUiProvider>
 */
export function DesignerUiProvider({ transport, children }: DesignerUiProviderProps) {
  // Register the transport synchronously during render so children that call
  // `callApi()` in their initial effects already see it. `setApiTransport` is
  // idempotent — calling it on every render with the same instance is a no-op.
  //
  // We deliberately do NOT clear the registry in a `useEffect` cleanup. The
  // transport singleton is global to the host shell and must outlive any
  // individual provider mount. Clearing it on unmount creates a race with
  // React 19 StrictMode dev-only "disconnect/reconnect" semantics, where the
  // provider's effect cleanup runs (setting the transport to null) but the
  // render function is NOT re-invoked on reconnect — leaving children that
  // run `callApi` in their reconnected effects with no transport.
  setApiTransport(transport);

  return <>{children}</>;
}
