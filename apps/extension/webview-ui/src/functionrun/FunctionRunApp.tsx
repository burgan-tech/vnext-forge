import { useEffect, useState } from 'react';

import {
  FunctionRunShell,
  isMessageOriginAllowed,
  useToolHeadersStore,
  type FunctionRunShellProps,
} from '@vnext-forge-studio/designer-ui';

import { resolveWebviewPostMessageAllowedOrigins } from '../host/webviewMessageOrigins';
import type { VsCodeWebviewApi } from '../VsCodeTransport';

interface FunctionRunContext {
  domain: string;
  functionKey: string;
  scope: FunctionRunShellProps['scope'];
  runtimeUrl?: string;
}

interface Props {
  api: VsCodeWebviewApi;
}

/** Narrows an unknown `postMessage` field to a string-valued record, dropping any non-string entries. */
function readStringRecord(value: unknown): Record<string, string> | null {
  if (value == null || typeof value !== 'object') return null;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

export function FunctionRunApp({ api }: Props) {
  const [context, setContext] = useState<FunctionRunContext | null>(null);
  const toolWideHeaders = useToolHeadersStore((s) => s.headers);

  useEffect(() => {
    const allowedOrigins = resolveWebviewPostMessageAllowedOrigins();

    function handleMessage(event: MessageEvent) {
      if (!isMessageOriginAllowed(event.origin, allowedOrigins)) return;

      const data = event.data;
      if (data?.type === 'functionrun:context') {
        setContext({
          domain: data.domain,
          functionKey: data.functionKey,
          scope: data.scope,
          runtimeUrl: data.runtimeUrl,
        });
        // Forge-wide headers (Task 19) — forwarded by
        // `FunctionQuickRunPanel.sendContext`. Populate the shared store so
        // `FunctionRunShell` can merge them into every engine call, the same
        // way `QuickRunApp` does for the workflow runner.
        const messagePayload = data as { globalHeaders?: unknown };
        const globalHeaders = readStringRecord(messagePayload.globalHeaders);
        if (globalHeaders) {
          useToolHeadersStore.getState().setHeaders(globalHeaders);
        }
      }
    }

    window.addEventListener('message', handleMessage);
    api.postMessage({ type: 'webview-ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [api]);

  if (!context) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--vscode-descriptionForeground)]">
        <p>Waiting for function context...</p>
      </div>
    );
  }

  return (
    <FunctionRunShell
      domain={context.domain}
      functionKey={context.functionKey}
      scope={context.scope}
      runtimeUrl={context.runtimeUrl}
      toolWideHeaders={toolWideHeaders}
    />
  );
}
