import type { ApiResponse } from '@vnext-forge/app-contracts';
import type { ApiTransport } from '@vnext-forge/designer-ui';

export interface HttpTransportOptions {
  /**
   * Base URL of the Hono RPC server. The transport POSTs to
   * `${baseUrl}/api/rpc` with `{ method, params }`.
   */
  baseUrl?: string;
  /**
   * Optional override for the default `fetch` implementation. Useful for
   * tests, server-side rendering, and custom auth wrappers.
   */
  fetchImpl?: typeof fetch;
  /**
   * Per-request timeout in milliseconds. Defaults to 30s.
   */
  timeoutMs?: number;
}

/**
 * Standalone web SPA transport. Sends each `ApiTransport.send()` call as a
 * single POST to the RPC endpoint of the colocated Hono web-server, which
 * dispatches the call against the shared services-core method registry.
 */
export function createHttpTransport(options: HttpTransportOptions = {}): ApiTransport {
  const baseUrl = options.baseUrl ?? '';
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    async send<T>(method: string, params: unknown): Promise<ApiResponse<T>> {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${baseUrl}/api/rpc`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method, params: params ?? {} }),
          signal: controller.signal,
        });

        const payload = (await response.json()) as ApiResponse<T>;
        return payload;
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}
