import type { ApiResponse } from '@vnext-forge/app-contracts';

/**
 * Platform-agnostic transport contract for designer-ui modules.
 *
 * Each shell (apps/web SPA, apps/extension webview, future hosts)
 * provides its own implementation:
 *  - apps/web -> HttpTransport (Hono RPC over fetch)
 *  - apps/extension webview -> VsCodeTransport (postMessage to extension host)
 *
 * Modules inside @vnext-forge/designer-ui never construct a transport
 * themselves; they call `callApi()` / `unwrapApi()` which delegate to
 * whatever transport the host shell registered via `setApiTransport()`.
 */
export interface ApiTransport {
  /**
   * Send a method call to the underlying backend (extension host or web server)
   * and return the standardized ApiResponse envelope. Implementations are
   * responsible for timeouts, retries and serialization.
   */
  send<T>(method: string, params: unknown): Promise<ApiResponse<T>>;
}

let registeredTransport: ApiTransport | null = null;

/**
 * Register the active ApiTransport implementation. Should be called exactly
 * once per webview / SPA session, before the first module render.
 *
 * `DesignerUiProvider` calls this internally based on its `transport` prop.
 */
export function setApiTransport(transport: ApiTransport | null): void {
  registeredTransport = transport;
}

/**
 * Get the currently registered ApiTransport, or throw if no host shell
 * registered one. This is called from internal designer-ui API helpers
 * (callApi / unwrapApi) and module-level service files.
 */
export function getApiTransport(): ApiTransport {
  if (!registeredTransport) {
    throw new Error(
      '[designer-ui] No ApiTransport registered. Wrap your app with <DesignerUiProvider transport={...}> before rendering designer-ui modules.',
    );
  }
  return registeredTransport;
}
