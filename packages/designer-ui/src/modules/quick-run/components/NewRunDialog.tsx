import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';
import * as QuickRunApi from '../QuickRunApi';
import type { WorkflowBucketConfig } from '../QuickRunApi';
import { useQuickRunPolling } from '../hooks/useQuickRunPolling';
import { useQuickRunStore } from '../store/quickRunStore';
import { JsonEditorWithCopy } from './CopyableJsonBlock';
import { ValidationErrorBlock } from './ValidationErrorBlock';

interface NewRunDialogProps {
  open: boolean;
  onClose: () => void;
  configRef: MutableRefObject<WorkflowBucketConfig>;
  persistConfig: (cfg: WorkflowBucketConfig) => void;
}

export function NewRunDialog({ open, onClose, configRef, persistConfig }: NewRunDialogProps) {
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const environmentName = useQuickRunStore((s) => s.environmentName);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const addInstance = useQuickRunStore((s) => s.addInstance);
  const addTab = useQuickRunStore((s) => s.addTab);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);

  const { pollState } = useQuickRunPolling(pollingConfig);

  const [instanceKey, setInstanceKey] = useState('');
  const [tags, setTags] = useState('');
  const [attributes, setAttributes] = useState('{}');
  const [sync, setSync] = useState(true);
  const [version, setVersion] = useState('');
  const [headerRows, setHeaderRows] = useState<{ name: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null);

  const generateKey = useCallback(() => {
    setInstanceKey(crypto.randomUUID());
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorDetails(null);

    let parsedAttributes: Record<string, unknown> = {};
    if (attributes.trim() && attributes.trim() !== '{}') {
      try {
        parsedAttributes = JSON.parse(attributes);
      } catch {
        setError('Invalid JSON in attributes field');
        setLoading(false);
        return;
      }
    }

    const tagsList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const mergedHeaders: Record<string, string> = {};
      for (const h of headerRows) {
        if (h.name.trim()) mergedHeaders[h.name.trim()] = h.value;
      }

      const result = await QuickRunApi.startInstance({
        domain,
        workflowKey,
        sync,
        version: version.trim() || undefined,
        key: instanceKey || undefined,
        tags: tagsList.length > 0 ? tagsList : undefined,
        attributes: Object.keys(parsedAttributes).length > 0 ? parsedAttributes : undefined,
        headers: mergedHeaders,
      });

      if (result.success) {
        const newInstance = {
          id: result.data.id,
          key: result.data.key,
          status: result.data.status as 'A' | 'B' | 'C' | 'F',
          domain,
          workflowKey,
          environmentName,
          startedAt: new Date().toISOString(),
        };
        addInstance(newInstance);
        addTab({
          instanceId: result.data.id,
          domain,
          workflowKey,
          environmentName,
          label: result.data.key || result.data.id.slice(0, 8),
        });

        void pollState({
          domain,
          workflowKey,
          instanceId: result.data.id,
          headers: mergedHeaders,
        });

        const localOverrides: Record<string, string> = {};
        for (const h of headerRows) {
          if (h.name.trim() && !(h.name.trim() in globalHeaders && globalHeaders[h.name.trim()] === h.value)) {
            localOverrides[h.name.trim()] = h.value;
          }
        }

        const updated: WorkflowBucketConfig = {
          ...configRef.current,
          start: {
            headers: localOverrides,
            queryStrings: { sync, version: version.trim() || undefined },
            body: {
              key: instanceKey || undefined,
              tags: tagsList.length > 0 ? tagsList : undefined,
              attributes: Object.keys(parsedAttributes).length > 0 ? parsedAttributes : {},
            },
          },
        };
        persistConfig(updated);

        onClose();
        setInstanceKey('');
        setTags('');
        setAttributes('{}');
        setSync(true);
        setVersion('');
        setHeaderRows([]);
      } else {
        setError(result.error.message);
        setErrorDetails(result.error.details ?? null);
      }
    } catch {
      setError('Failed to start instance. Please try again.');
    }

    setLoading(false);
  }, [domain, workflowKey, instanceKey, tags, attributes, sync, version, headerRows, globalHeaders, environmentName, addInstance, addTab, pollState, onClose, configRef, persistConfig]);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    const cfg = configRef.current;
    const startCfg = cfg.start;

    if (startCfg.body?.key) setInstanceKey(startCfg.body.key);
    if (startCfg.body?.tags?.length) setTags(startCfg.body.tags.join(', '));
    if (startCfg.body?.attributes && Object.keys(startCfg.body.attributes).length > 0) {
      setAttributes(JSON.stringify(startCfg.body.attributes, null, 2));
    }
    if (startCfg.queryStrings?.sync !== undefined) setSync(startCfg.queryStrings.sync);
    if (startCfg.queryStrings?.version) setVersion(startCfg.queryStrings.version);

    const rows: { name: string; value: string }[] = Object.entries(globalHeaders).map(([name, value]) => ({ name, value }));
    if (startCfg.headers) {
      for (const [name, value] of Object.entries(startCfg.headers)) {
        const existing = rows.find((r) => r.name === name);
        if (existing) {
          existing.value = value;
        } else {
          rows.push({ name, value });
        }
      }
    }
    setHeaderRows(rows);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-run-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-[560px] max-h-[80vh] flex flex-col rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] shadow-lg focus:outline-none"
      >
        <header className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3">
          <h2 id="new-run-title" className="text-sm font-semibold">
            Start Flow Run
          </h2>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                  onClick={onClose}
                  aria-label="Close"
                >
                  ✕
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px]">
                Close
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </header>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
          <div className="text-xs text-[var(--vscode-descriptionForeground)]">
            Starting instance for <strong>{domain}/{workflowKey}</strong>
          </div>

          {/* Instance Key */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Instance Key (optional)</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={instanceKey}
                onChange={(e) => setInstanceKey(e.target.value)}
                placeholder="Auto-generated if empty"
                className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
              />
              <button
                className="rounded border border-[var(--vscode-panel-border)] px-2 py-1 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                onClick={generateKey}
                title="Generate UUID"
              >
                Generate
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Tags (optional, comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
          </div>

          {/* Attributes */}
          <JsonEditorWithCopy
            label="Attributes (JSON)"
            value={attributes}
            onChange={setAttributes}
            rows={8}
          />

          {/* Headers */}
          <HeaderOverrideSection rows={headerRows} setRows={setHeaderRows} />

          {/* Advanced: sync & version */}
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
              Advanced (optional)
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={sync}
                  onChange={(e) => setSync(e.target.checked)}
                />
                Synchronous execution
              </label>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">Version</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="latest"
                  className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                />
              </div>
            </div>
          </details>

          {error && (
            <ValidationErrorBlock message={error} details={errorDetails ?? undefined} />
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Starting...' : 'Start Run'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function HeaderOverrideSection({
  rows,
  setRows,
}: {
  rows: { name: string; value: string }[];
  setRows: (v: { name: string; value: string }[]) => void;
}) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
        Headers{rows.length > 0 ? ` (${rows.length})` : ''}
      </summary>
      <div className="mt-2 flex flex-col gap-1">
        {rows.map((h, i) => (
          <div key={i} className="flex gap-1">
            <input
              type="text"
              value={h.name}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], name: e.target.value };
                setRows(next);
              }}
              placeholder="Header name"
              className="w-28 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
            <input
              type="text"
              value={h.value}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], value: e.target.value };
                setRows(next);
              }}
              placeholder="Value"
              className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-1 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="text-[var(--vscode-errorForeground)] hover:text-[var(--vscode-foreground)]"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-[11px]">
                  Remove
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
        <button
          className="self-start text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={() => setRows([...rows, { name: '', value: '' }])}
        >
          + Add header
        </button>
      </div>
    </details>
  );
}
