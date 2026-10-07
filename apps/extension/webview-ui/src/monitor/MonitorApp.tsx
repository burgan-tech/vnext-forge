import { useEffect, useState } from 'react';

import { isMessageOriginAllowed, useToolHeadersStore } from '@vnext-forge-studio/designer-ui';
import { MonitorShell, publishInstanceChange, type MonitorTarget } from '@vnext-forge-studio/designer-ui/monitor';

import { resolveWebviewPostMessageAllowedOrigins } from '../host/webviewMessageOrigins';
import type { VsCodeWebviewApi } from '../VsCodeTransport';

function readStringRecord(value: unknown): Record<string, string> {
  if (value == null || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}

export function MonitorApp({ api }: { api: VsCodeWebviewApi }) {
  const [target, setTarget] = useState<MonitorTarget | null>(null);
  const headers = useToolHeadersStore((s) => s.headers);

  useEffect(() => {
    const allowedOrigins = resolveWebviewPostMessageAllowedOrigins();
    function handleMessage(event: MessageEvent) {
      if (!isMessageOriginAllowed(event.origin, allowedOrigins)) return;
      const data = event.data as Record<string, unknown> | null;
      if (data?.type === 'monitor:instance-changed') {
        if (typeof data.domain !== 'string' || typeof data.instanceId !== 'string') return;
        publishInstanceChange(
          {
            domain: data.domain,
            instanceId: data.instanceId,
            ...(typeof data.status === 'string' ? { status: data.status } : {}),
            ...(typeof data.state === 'string' ? { state: data.state } : {}),
          },
          { relay: false },
        );
        return;
      }
      if (data?.type !== 'monitor:context') return;
      setTarget({
        domain: String(data.domain),
        workflowKey: String(data.workflowKey),
        instanceId: String(data.instanceId),
        ...(typeof data.workflowFilePath === 'string' && data.workflowFilePath ? { workflowFilePath: data.workflowFilePath } : {}),
        projectId: String(data.projectId),
        ...(typeof data.environmentName === 'string' ? { environmentName: data.environmentName } : {}),
        ...(typeof data.environmentUrl === 'string' ? { runtimeUrl: data.environmentUrl } : {}),
      });
      useToolHeadersStore.getState().setHeaders(readStringRecord(data.globalHeaders));
    }
    window.addEventListener('message', handleMessage);
    api.postMessage({ type: 'webview-ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, [api]);

  if (!target) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--vscode-descriptionForeground)]">
        <p>Waiting for instance context...</p>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <MonitorShell
        target={target}
        headers={headers}
        onOpenComponent={(t) => api.postMessage({ type: 'host:open-designer', absolutePath: t.filePath })}
        onOpenScript={(absolutePath) => api.postMessage({ type: 'host:open-workspace-file', absolutePath })}
        {...(target.workflowFilePath
          ? {
              onOpenQuickRun: (instanceId: string, isRoot: boolean) =>
                // The host only knows the root workflow; a child level's id would be foreign to that Quick Run.
                api.postMessage({ type: 'monitor:open-quickrun', ...(isRoot ? { instanceId } : {}) }),
            }
          : {})}
        onOpenInstanceMonitor={(t) => api.postMessage({ type: 'monitor:open-instance', ...t })}
        {...(target.workflowFilePath
          ? { onOpenFlowDesigner: () => api.postMessage({ type: 'host:open-designer', absolutePath: target.workflowFilePath }) }
          : {})}
      />
    </div>
  );
}
