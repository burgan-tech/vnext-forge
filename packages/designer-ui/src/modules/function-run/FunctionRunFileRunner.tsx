import { useMemo, useState } from 'react';

import { downloadFile } from '../quick-run/QuickRunApi';
import { HeadersConfigDialog } from '../quick-run/components/HeadersConfigDialog';
import { RuntimeErrorBanner, type RuntimeErrorLike } from '../quick-run/components/RuntimeErrorBanner';
import { mergeQuickRunHeaders } from '../quick-run/pseudo-ui/mergeQuickRunHeaders';

import { areToolHeadersHostOwned } from '../../app/ToolHeadersSync.js';
import { Field } from '../../ui/Field.js';
import { Input } from '../../ui/Input.js';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/Resizable.js';
import { useToolHeadersStore } from '../../store/useToolHeadersStore.js';

import { FunctionRunEndpointBar } from './components/FunctionRunEndpointBar';
import { FunctionRunFileResult } from './components/FunctionRunFileResult';
import { FunctionRunHeadersTab } from './components/FunctionRunHeadersTab';
import { sanitizeHeaderRecord } from './functionRunHeaders';
import {
  buildFileFunctionEndpoint,
  fileFunctionInvokeBlocker,
  type FileFunctionResponse,
} from './functionRunFile';

export interface FunctionRunFileRunnerProps {
  domain: string;
  workflowKey?: string;
  instanceId?: string;
  runtimeUrl?: string;
  toolWideHeaders?: Record<string, string>;
  surface?: 'panel' | 'standalone';
}

const FILE_VERBS = ['GET'] as const;

const DEFAULT_LAYOUT = {
  'function-run-file-request': 50,
  'function-run-file-response': 50,
} as const;

type FileRunResult =
  | { kind: 'file'; response: FileFunctionResponse; fileId: string; durationMs: number }
  | { kind: 'error'; error: RuntimeErrorLike };

/**
 * Function Run for the runtime's built-in `file` function. It has no `/info`
 * or contract and answers with bytes, so instead of the contract-driven
 * runner it takes the instance binding and a `file` id and calls
 * `quickrun/downloadFile` — the binary-safe RPC behind Quick Run's file chips.
 */
export function FunctionRunFileRunner({
  domain,
  workflowKey: initialWorkflowKey,
  instanceId: initialInstanceId,
  runtimeUrl,
  toolWideHeaders,
  surface = 'panel',
}: FunctionRunFileRunnerProps) {
  const [workflowKey, setWorkflowKey] = useState(initialWorkflowKey ?? '');
  const [instanceId, setInstanceId] = useState(initialInstanceId ?? '');
  const [fileId, setFileId] = useState('');
  const [sessionHeaders, setSessionHeaders] = useState<Record<string, string>>({});
  const [headersOpen, setHeadersOpen] = useState(false);
  const [invoking, setInvoking] = useState(false);
  const [result, setResult] = useState<FileRunResult | null>(null);

  const toolWideHeadersRecord = toolWideHeaders ?? {};
  const toolWideHeadersHostOwned = areToolHeadersHostOwned();
  const sessionHeadersKey = JSON.stringify(sessionHeaders);
  const toolWideHeadersKey = JSON.stringify(toolWideHeadersRecord);
  const headers = useMemo(
    () => mergeQuickRunHeaders(null, sanitizeHeaderRecord(sessionHeaders), undefined, toolWideHeadersRecord),
    [sessionHeadersKey, toolWideHeadersKey],
  );

  const target = { domain, workflowKey, instanceId, file: fileId };
  const blocker = fileFunctionInvokeBlocker(target);

  async function handleInvoke() {
    if (blocker !== null) return;
    const requestedFile = fileId.trim();
    setInvoking(true);
    const started = performance.now();
    try {
      const response = await downloadFile({
        domain,
        workflowKey: workflowKey.trim(),
        instanceId: instanceId.trim(),
        file: requestedFile,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(runtimeUrl ? { runtimeUrl } : {}),
      });
      setResult(
        response.success
          ? { kind: 'file', response: response.data, fileId: requestedFile, durationMs: performance.now() - started }
          : { kind: 'error', error: response.error },
      );
    } catch (err) {
      setResult({
        kind: 'error',
        error: { code: 'INTERNAL_UNEXPECTED', message: err instanceof Error ? err.message : String(err) },
      });
    } finally {
      setInvoking(false);
    }
  }

  function handleOpenHeaders() {
    // Host-owned Forge-wide headers cannot be saved from here (see
    // `resolveOpenHeadersAction`); the Headers section below is always shown.
    if (!toolWideHeadersHostOwned) setHeadersOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border-subtle border-b p-2">
        <FunctionRunEndpointBar
          verbs={FILE_VERBS}
          verb="GET"
          onVerbChange={() => undefined}
          endpoint={buildFileFunctionEndpoint(target)}
          canInvoke={blocker === null}
          invokeDisabledReason={blocker}
          invoking={invoking}
          onInvoke={() => void handleInvoke()}
          onOpenHeaders={handleOpenHeaders}
        />
      </div>

      <ResizablePanelGroup
        id="function-run-file"
        orientation={surface === 'standalone' ? 'vertical' : 'horizontal'}
        defaultLayout={DEFAULT_LAYOUT}
        className="min-h-0 flex-1">
        <ResizablePanel id="function-run-file-request" minSize="20%" className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-[11px]">
                Built-in function: returns the bytes of a file stored in this instance&apos;s data. Use the{' '}
                <code>file</code> id of a stored file handle; the instance must be the handle&apos;s owner.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Workflow key" className="min-w-40 flex-1">
                  <Input size="sm" value={workflowKey} onChange={(e) => setWorkflowKey(e.target.value)} />
                </Field>
                <Field label="Instance id" className="min-w-40 flex-1">
                  <Input size="sm" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
                </Field>
              </div>
              <Field label="File id (file)">
                <Input
                  size="sm"
                  value={fileId}
                  placeholder="e.g. 3f2b9c1e-…"
                  onChange={(e) => setFileId(e.target.value)}
                />
              </Field>
              <FunctionRunHeadersTab
                toolWideHeaders={toolWideHeadersRecord}
                toolWideHeadersHostOwned={toolWideHeadersHostOwned}
                sessionHeaders={sessionHeaders}
                onSessionHeadersChange={setSessionHeaders}
                onEditToolWideHeaders={() => setHeadersOpen(true)}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel id="function-run-file-response" minSize="20%" className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {result?.kind === 'file' ? (
              <FunctionRunFileResult response={result.response} fileId={result.fileId} durationMs={result.durationMs} />
            ) : result?.kind === 'error' ? (
              <RuntimeErrorBanner title="File request failed" error={result.error} onDismiss={() => setResult(null)} />
            ) : (
              <p className="text-muted-foreground text-xs">Enter a file id and choose Send to fetch the file.</p>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <HeadersConfigDialog
        open={headersOpen}
        onClose={() => setHeadersOpen(false)}
        initialHeaders={Object.entries(toolWideHeadersRecord).map(([name, value]) => ({ name, value }))}
        onSave={(nextHeaders) =>
          useToolHeadersStore.getState().setHeaders(Object.fromEntries(nextHeaders.map((h) => [h.name, h.value])))
        }
      />
    </div>
  );
}
