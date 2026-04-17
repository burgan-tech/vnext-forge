import type {
  NetworkAdapter,
  NetworkRequestInit,
  NetworkResponse,
} from '@vnext-forge/services-core';

/**
 * VS Code extension host `NetworkAdapter`. Uses the platform `fetch` provided
 * by the Node runtime embedded in VS Code.
 */
export function createVsCodeNetworkAdapter(): NetworkAdapter {
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
