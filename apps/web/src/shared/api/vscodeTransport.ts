import type { ApiResponse } from '@vnext-forge/app-contracts';

// VS Code injects acquireVsCodeApi() into the webview global scope.
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

type PendingEntry = {
  resolve: (value: ApiResponse<unknown>) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingEntry>();
// acquireVsCodeApi() may only be called once per webview session.
let vsApi: ReturnType<typeof acquireVsCodeApi> | null = null;

export function getVsCodeApi() {
  if (!vsApi) {
    vsApi = acquireVsCodeApi();
  }
  return vsApi;
}

function getApi() {
  return getVsCodeApi();
}

// Single listener handles all incoming responses from the extension host.
window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { requestId?: string; result?: ApiResponse<unknown> };
  if (typeof msg?.requestId !== 'string') return;

  const entry = pending.get(msg.requestId);
  if (!entry) return;

  pending.delete(msg.requestId);
  clearTimeout(entry.timer);
  entry.resolve(msg.result as ApiResponse<unknown>);
});

let counter = 0;
function nextId(): string {
  return `vsrpc-${++counter}`;
}

/** Send a typed API request to the extension host and await its ApiResponse. */
export function sendToHost<T>(method: string, params: unknown = {}): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    const requestId = nextId();

    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`[vscodeTransport] Request timed out: ${method}`));
    }, 30_000);

    pending.set(requestId, {
      resolve: (v) => resolve(v as ApiResponse<T>),
      reject,
      timer,
    });

    getApi().postMessage({ requestId, type: 'api', method, params });
  });
}
