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

/**
 * `window.__VNEXT_CONFIG__`, or `undefined` outside a browser context. This
 * package's own vitest suite runs with no DOM at all (`typeof window` is
 * `'undefined'` there), so a bare property read would throw instead of
 * simply reporting "nothing injected" — the `typeof` guard is what lets
 * `areToolHeadersHostOwned` below be called directly from a test.
 */
function readVnextConfig(): Record<string, unknown> | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __VNEXT_CONFIG__?: Record<string, unknown> }).__VNEXT_CONFIG__;
}

/**
 * True when the host injected the Forge-wide headers, which makes the host
 * the source of truth: `ToolHeadersSync` (below) re-reads the injected value
 * on every mount, so anything a user edited in-app would be silently
 * overwritten the next time the panel opens — `DesignerPanel.buildWebviewConfig`
 * and `FunctionRunApp`'s `functionrun:context` handler both inject this once
 * per panel build/open, with no write-back path from the webview. The web
 * shell injects nothing, so its persisted `useToolHeadersStore` copy IS the
 * truth there, and the set is safely editable — see `FunctionRunHeadersTab`,
 * the one place that reads this to decide whether to offer an editor at all.
 *
 * Keyed on the exact same injected value `readInjectedToolWideHeaders` reads.
 * An injected *empty* object still counts as host-owned — the host chose to
 * inject "no headers", which is still an opinion the host owns and could
 * inject differently on the next open. Only a genuinely *absent* key (or no
 * `__VNEXT_CONFIG__`/`window` at all) means nothing was injected.
 */
export function areToolHeadersHostOwned(): boolean {
  return parseInjectedToolWideHeaders(readVnextConfig()?.globalHeaders) !== null;
}

function readInjectedToolWideHeaders(): Record<string, string> | null {
  return parseInjectedToolWideHeaders(readVnextConfig()?.globalHeaders);
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
