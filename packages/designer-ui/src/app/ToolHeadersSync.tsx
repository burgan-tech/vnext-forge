import { useEffect } from 'react';

import { useToolHeadersStore } from '../store/useToolHeadersStore.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Narrows the host-injected `globalHeaders` field to a string-valued map.
 * `null` for anything that isn't an object (missing key, wrong type, etc.);
 * non-string entries inside an otherwise-valid object are silently dropped
 * rather than failing the whole map, since a single malformed header
 * shouldn't take out every other configured header.
 */
export function parseInjectedToolWideHeaders(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function readInjectedToolWideHeaders(): Record<string, string> | null {
  const config = (window as unknown as { __VNEXT_CONFIG__?: Record<string, unknown> }).__VNEXT_CONFIG__;
  return parseInjectedToolWideHeaders(config?.globalHeaders);
}

/**
 * Extension designer webview only: `DesignerPanel.buildWebviewConfig` injects
 * the persisted Quick Run `globalHeaders` setting into
 * `window.__VNEXT_CONFIG__.globalHeaders` (Task 19) since that panel's HTML
 * is only built once per panel — there's no per-open `*:context` message the
 * way Quick Run has (see `QuickRunApp`'s own `quickrun:context` handler,
 * which populates the same store directly).
 *
 * The web shell never injects this key, so `readInjectedToolWideHeaders`
 * returns `null` there and this is a no-op — `useToolHeadersStore`'s own
 * `persist` middleware rehydrates the value from `localStorage` instead.
 */
export function ToolHeadersSync() {
  const setHeaders = useToolHeadersStore((s) => s.setHeaders);

  useEffect(() => {
    const injected = readInjectedToolWideHeaders();
    if (injected) setHeaders(injected);
  }, [setHeaders]);

  return null;
}
