import { useEffect } from 'react';

import { isMessageOriginAllowed } from '../lib/messageOriginPolicy.js';
import { useRuntimeStore } from '../store/useRuntimeStore.js';

const RUNTIME_ENVIRONMENT_CHANGED = 'host:runtime-environment-changed';
const DEFAULT_WEBVIEW_ORIGINS = ['vscode-webview:', 'vscode-file://vscode-app'];

function readVnextConfig(): Record<string, unknown> | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __VNEXT_CONFIG__?: Record<string, unknown> }).__VNEXT_CONFIG__;
}

/** A non-empty http(s) URL string, else `null`. */
export function parseInjectedRuntimeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed.replace(/\/+$/, '') : null;
}

function allowedOrigins(config: Record<string, unknown> | undefined): string[] {
  const injected = Array.isArray(config?.POST_MESSAGE_ALLOWED_ORIGINS)
    ? config.POST_MESSAGE_ALLOWED_ORIGINS.filter((o): o is string => typeof o === 'string')
    : [];
  return [...new Set([...injected, ...DEFAULT_WEBVIEW_ORIGINS])];
}

/**
 * Extension designer webview only: `DesignerPanel` injects the active Forge
 * runtime environment as `__VNEXT_CONFIG__.runtimeUrl` and posts
 * `host:runtime-environment-changed` when the user switches environments.
 * This seeds `useRuntimeStore.runtimeUrl`, which the in-designer runtime
 * calls (Function Run, AI Agent dry run) pass as `runtimeUrl`; without it
 * they fall back to the proxy's default runtime.
 *
 * The web shell injects nothing (it syncs the store from its own environment
 * store), so this is a no-op there.
 */
export function RuntimeUrlSync() {
  const setRuntimeUrl = useRuntimeStore((s) => s.setRuntimeUrl);

  useEffect(() => {
    const config = readVnextConfig();
    if (!config) return;
    const injected = parseInjectedRuntimeUrl(config.runtimeUrl);
    if (injected) setRuntimeUrl(injected);

    const origins = allowedOrigins(config);
    function handleMessage(event: MessageEvent) {
      if (!isMessageOriginAllowed(event.origin, origins)) return;
      const data = event.data as Record<string, unknown> | undefined;
      if (data?.type !== RUNTIME_ENVIRONMENT_CHANGED) return;
      const next = parseInjectedRuntimeUrl(data.runtimeUrl);
      if (next) setRuntimeUrl(next);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setRuntimeUrl]);

  return null;
}
