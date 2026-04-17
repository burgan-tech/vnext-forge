import { useEffect, useRef, type ReactNode } from 'react';
import { setApiTransport, type ApiTransport } from '../api/transport.js';
import { NotificationContainer } from '../notification/ui/NotificationContainer.js';

export interface DesignerUiProviderProps {
  /**
   * Platform-specific API transport. The host shell (apps/web SPA or
   * apps/extension webview) constructs this and passes it down so designer-ui
   * modules can call `callApi()` / `unwrapApi()` without knowing about HTTP,
   * postMessage, etc.
   */
  transport: ApiTransport;
  /**
   * If true, mount the bundled `<NotificationContainer>` (sonner-based toaster)
   * inside the provider. Hosts that already render their own toaster can pass
   * `false`. Default: true.
   */
  withNotificationContainer?: boolean;
  children: ReactNode;
}

/**
 * Top-level provider for designer-ui. Registers the active ApiTransport and
 * (optionally) renders the shared notification container. Wrap the entire
 * designer-ui consumer tree (router, modules, pages) with this provider.
 *
 * @example
 * // apps/web (SPA shell)
 * <DesignerUiProvider transport={httpTransport}>
 *   <AppRouter />
 * </DesignerUiProvider>
 *
 * @example
 * // apps/extension webview
 * <DesignerUiProvider transport={vsCodeTransport}>
 *   <DesignerApp />
 * </DesignerUiProvider>
 */
export function DesignerUiProvider({
  transport,
  withNotificationContainer = true,
  children,
}: DesignerUiProviderProps) {
  // Register the transport synchronously during render so children that call
  // `callApi()` in their initial effects already see it. The cleanup runs on
  // unmount only; subsequent transport changes simply overwrite the registry.
  const registeredRef = useRef<ApiTransport | null>(null);
  if (registeredRef.current !== transport) {
    setApiTransport(transport);
    registeredRef.current = transport;
  }

  useEffect(() => {
    return () => {
      setApiTransport(null);
      registeredRef.current = null;
    };
  }, []);

  return (
    <>
      {children}
      {withNotificationContainer ? <NotificationContainer /> : null}
    </>
  );
}
