import { useEffect, useState } from 'react';

import { isMessageOriginAllowed } from '@vnext-forge/designer-ui';
import { QuickRunApi, QuickRunShell } from '@vnext-forge/designer-ui/quickrun';

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
}

interface Props {
  api: VsCodeWebviewApi;
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
        });
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
      pollingRetryCount={context.pollingRetryCount}
      pollingIntervalMs={context.pollingIntervalMs}
    />
  );
}
