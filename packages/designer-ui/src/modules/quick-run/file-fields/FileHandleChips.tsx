import { useState } from 'react';

import { downloadFile } from '../QuickRunApi';
import { RuntimeErrorBanner, type RuntimeErrorLike } from '../components/RuntimeErrorBanner';
import { collectFileHandles, formatBytes, type FileHandle } from '../utils/fileFields';
import { openFile, saveFileAs, type HostFile } from './fileHostActions';

export interface FileHandleChipsProps {
  /** Instance data to scan for stored file handles. */
  data: unknown;
  /** Fallbacks when a handle has no `owner` (it normally does). */
  domain: string;
  workflowKey: string;
  instanceId: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

const buttonClass =
  'cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-[var(--vscode-textLink-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] disabled:cursor-wait disabled:opacity-50';

/**
 * Stored `x-storage` files in instance data, each with Open and Save as. The
 * bytes come from the built-in `file` function of the instance named in the
 * handle's `owner` (a parent never reads its SubFlow's files).
 */
export function FileHandleChips({ data, domain, workflowKey, instanceId, headers, runtimeUrl }: FileHandleChipsProps) {
  const handles = collectFileHandles(data);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<RuntimeErrorLike | null>(null);
  if (handles.length === 0) return null;

  const fetchFile = async (handle: FileHandle): Promise<HostFile | null> => {
    const response = await downloadFile({
      domain: handle.owner?.domain ?? domain,
      workflowKey: handle.owner?.flow ?? workflowKey,
      instanceId: handle.owner?.instance ?? instanceId,
      file: handle.file,
      ...(headers ? { headers } : {}),
      ...(runtimeUrl ? { runtimeUrl } : {}),
    });
    if (!response.success) {
      setError(response.error);
      return null;
    }
    return {
      fileName: handle.name ?? response.data.fileName ?? handle.file,
      mimeType: response.data.contentType !== '' ? response.data.contentType : (handle.mimeType ?? 'application/octet-stream'),
      contentBase64: response.data.contentBase64,
    };
  };

  const run = async (key: string, handle: FileHandle, action: (file: HostFile) => void) => {
    setBusy(key);
    setError(null);
    try {
      const file = await fetchFile(handle);
      if (file) action(file);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-2 flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
        Files
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {handles.map(({ path, handle }) => {
          const key = `${path}:${handle.file}`;
          return (
            <li
              key={key}
              className="flex flex-wrap items-center gap-2 rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[11px]">
              <span className="font-mono text-[var(--vscode-descriptionForeground)]">{path}</span>
              <span className="font-mono">{handle.name ?? handle.file}</span>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                {[formatBytes(handle.size), handle.mimeType].filter(Boolean).join(' · ')}
              </span>
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy !== null}
                  onClick={() => void run(key, handle, openFile)}>
                  {busy === key ? 'Loading…' : 'Open'}
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy !== null}
                  onClick={() => void run(key, handle, saveFileAs)}>
                  Save as…
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {error ? <RuntimeErrorBanner title="File download failed" error={error} onDismiss={() => setError(null)} /> : null}
    </div>
  );
}
