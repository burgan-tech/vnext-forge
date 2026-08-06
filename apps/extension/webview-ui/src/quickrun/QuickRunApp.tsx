import { useEffect, useState } from 'react';

import { isMessageOriginAllowed, useToolHeadersStore } from '@vnext-forge-studio/designer-ui';
import {
  QuickRunApi,
  QuickRunShell,
  type SchemaReference,
} from '@vnext-forge-studio/designer-ui/quickrun';

import { resolveWebviewPostMessageAllowedOrigins } from '../host/webviewMessageOrigins';
import type { VsCodeWebviewApi } from '../VsCodeTransport';

interface QuickRunContext {
  domain: string;
  workflowKey: string;
  projectId: string;
  projectPath: string;
  environmentName?: string;
  environmentUrl?: string;
  pollingRetryCount?: number;
  pollingIntervalMs?: number;
  /**
   * Forwarded from the extension host. When present, `NewRunDialog` can
   * faker-fill the start payload via the test-data backend.
   */
  startSchemaRef?: SchemaReference;
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

export function QuickRunApp({ api }: Props) {
  const [context, setContext] = useState<QuickRunContext | null>(null);

  useEffect(() => {
    QuickRunApi.setDataBucketPostMessage((msg) => api.postMessage(msg));
  }, [api]);

  useEffect(() => {
    const allowedOrigins = resolveWebviewPostMessageAllowedOrigins();

    function handleMessage(event: MessageEvent) {
      if (!isMessageOriginAllowed(event.origin, allowedOrigins)) return;

      const data = event.data;
      if (data?.type === 'quickrun:context') {
        setContext({
          domain: data.domain,
          workflowKey: data.workflowKey,
          projectId: data.projectId,
          projectPath: data.projectPath,
          environmentName: data.environmentName,
          environmentUrl: data.environmentUrl,
          pollingRetryCount: data.pollingRetryCount,
          pollingIntervalMs: data.pollingIntervalMs,
          startSchemaRef: data.startSchemaRef,
        });
        // Forge-wide headers (Task 19) — persisted in `quickrun-settings.json`,
        // forwarded by `QuickRunPanel.sendContextWithPolling`. Populate the
        // shared store so `QuickRunShell` can merge them into every engine call.
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
        <p>Waiting for workflow context...</p>
      </div>
    );
  }

  return (
    <QuickRunShell
      domain={context.domain}
      workflowKey={context.workflowKey}
      environmentName={context.environmentName}
      environmentUrl={context.environmentUrl}
      projectPath={context.projectPath}
      projectId={context.projectId}
      pollingRetryCount={context.pollingRetryCount}
      pollingIntervalMs={context.pollingIntervalMs}
      {...(context.startSchemaRef ? { startSchemaRef: context.startSchemaRef } : {})}
    />
  );
}
