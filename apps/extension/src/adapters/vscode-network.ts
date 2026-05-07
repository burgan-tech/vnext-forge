import type {
  NetworkAdapter,
  NetworkRequestInit,
  NetworkResponse,
} from '@vnext-forge-studio/services-core';

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
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      return {
        status: response.status,
        contentType,
        headers,
        text: () => response.text(),
      };
    },
  };
}
