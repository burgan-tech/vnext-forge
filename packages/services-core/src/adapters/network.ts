/**
 * Network adapter used by `runtime-proxy-service` to call the external vnext
 * runtime engine. A separate adapter (instead of using `globalThis.fetch`
 * directly) lets tests fake the network and lets a shell add custom timeouts,
 * proxy support or retries without touching the service code.
 */
export interface NetworkAdapter {
  fetch(input: string, init?: NetworkRequestInit): Promise<NetworkResponse>
}

export interface NetworkRequestInit {
  method: string
  headers: Record<string, string>
  body?: string
}

export interface NetworkResponse {
  status: number
  contentType: string
  text(): Promise<string>
}
