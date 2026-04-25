import type {
  NetworkAdapter,
  NetworkRequestInit,
  NetworkResponse,
} from '@vnext-forge/services-core';

/**
 * Concrete `NetworkAdapter` for Node-based shells. Thin wrapper around the
 * platform `fetch`. Adapter exists so tests / future shells can fake the
 * network without touching `runtime-proxy-service`.
 */
export function createNodeNetworkAdapter(): NetworkAdapter {
  return {
    async fetch(input: string, init?: NetworkRequestInit): Promise<NetworkResponse> {
      const response = await fetch(input, {
        method: init?.method,
        headers: init?.headers,
        body: init?.body,
      });

      const contentType = response.headers.get('content-type') ?? '';
      return {
        status: response.status,
        contentType,
        text: () => response.text(),
      };
    },
  };
}
