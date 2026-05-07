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
import type { SchemaResponse, ViewResponse } from '../types/quickrun.types';
import { safeViewContent } from '../types/quickrun.types';
import { CopyableJsonBlock, JsonEditorWithCopy } from './CopyableJsonBlock';
import { ValidationErrorBlock } from './ValidationErrorBlock';

interface TransitionDialogProps {
  configRef: MutableRefObject<WorkflowBucketConfig>;
  persistConfig: (cfg: WorkflowBucketConfig) => void;
}

export function TransitionDialog({ configRef, persistConfig }: TransitionDialogProps) {
  const open = useQuickRunStore((s) => s.transitionDialogOpen);
  const transition = useQuickRunStore((s) => s.transitionDialogTarget);
  const closeDialog = useQuickRunStore((s) => s.closeTransitionDialog);
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const sessionHeaders = useQuickRunStore((s) => s.sessionHeaders);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);

  const { pollState } = useQuickRunPolling(pollingConfig);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [transitionView, setTransitionView] = useState<ViewResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [attributes, setAttributes] = useState('{}');
  const [instanceKey, setInstanceKey] = useState('');
  const [tags, setTags] = useState('');
  const [headerRows, setHeaderRows] = useState<{ name: string; value: string }[]>([]);
  const [sync, setSync] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null);
  const [manualTransitionName, setManualTransitionName] = useState('');

  const isManualMode = open && transition === null;
  const transitionName = isManualMode ? manualTransitionName : (transition?.name ?? '');
  const hasSchema = transition?.schema?.hasSchema ?? false;
  const hasView = transition?.view?.hasView ?? false;

  useEffect(() => {
    if (!open || !activeTabId) return;

    setSchema(null);
    setTransitionView(null);
    setAttributes('{}');
    setInstanceKey('');
    setTags('');
    setError(null);
    setErrorDetails(null);
    setSubmitting(false);
    setManualTransitionName('');

    const inherited = { ...globalHeaders, ...sessionHeaders };
    const rows: { name: string; value: string }[] = Object.entries(inherited).map(([name, value]) => ({ name, value }));

    if (transition) {
      const savedTransition = configRef.current.transitions.find((t) => t.key === transition.name);
      if (savedTransition) {
        if (savedTransition.body?.key) setInstanceKey(savedTransition.body.key);
        if (savedTransition.body?.tags?.length) setTags(savedTransition.body.tags.join(', '));
        if (savedTransition.body?.attributes && Object.keys(savedTransition.body.attributes).length > 0) {
          setAttributes(JSON.stringify(savedTransition.body.attributes, null, 2));
        }
        if (savedTransition.headers) {
          for (const [name, value] of Object.entries(savedTransition.headers)) {
            const existing = rows.find((r) => r.name === name);
            if (existing) {
              existing.value = value;
            } else {
              rows.push({ name, value });
            }
          }
        }
      }

      const fetchParams = {
        domain,
        workflowKey,
        instanceId: activeTabId,
        transitionKey: transition.name,
        headers: inherited,
      };

      if (hasSchema) {
        setSchemaLoading(true);
        QuickRunApi.getSchema(fetchParams)
          .then((res) => {
            if (res.success) setSchema(res.data);
          })
          .catch(() => { /* schema not available */ })
          .finally(() => setSchemaLoading(false));
      }

      if (hasView) {
        setViewLoading(true);
        QuickRunApi.getView(fetchParams)
          .then((res) => {
            if (res.success) setTransitionView(res.data);
          })
          .catch(() => { /* view not available */ })
          .finally(() => setViewLoading(false));
      }
    }

    setHeaderRows(rows);
  }, [open, transition?.name]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDialog();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeDialog]);

  const buildAttributes = useCallback((): Record<string, unknown> | null => {
    if (!attributes.trim() || attributes.trim() === '{}') return {};
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      setError('Invalid JSON in attributes field');
      return null;
    }
  }, [attributes]);

  const handleSubmit = useCallback(async () => {
    if (!activeTabId) return;
    if (isManualMode && !manualTransitionName.trim()) {
      setError('Transition name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    setErrorDetails(null);

    const attrs = buildAttributes();
    if (attrs === null) {
      setSubmitting(false);
      return;
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

      const result = await QuickRunApi.fireTransition({
        domain,
        workflowKey,
        instanceId: activeTabId,
        transitionKey: transitionName,
        sync,
        key: instanceKey || undefined,
        tags: tagsList.length > 0 ? tagsList : undefined,
        attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
        headers: mergedHeaders,
      });

      if (result.success) {
        void pollState({
          domain,
          workflowKey,
          instanceId: activeTabId,
          headers: mergedHeaders,
        });

        if (!isManualMode) {
          const inherited = { ...globalHeaders, ...sessionHeaders };
          const localOverrides: Record<string, string> = {};
          for (const h of headerRows) {
            if (h.name.trim() && !(h.name.trim() in inherited && inherited[h.name.trim()] === h.value)) {
              localOverrides[h.name.trim()] = h.value;
            }
          }

          const cfg = configRef.current;
          const existingIdx = cfg.transitions.findIndex((t) => t.key === transitionName);
          const entry = {
            key: transitionName,
            headers: localOverrides,
            queryStrings: {},
            body: {
              key: instanceKey || undefined,
              tags: tagsList.length > 0 ? tagsList : undefined,
              attributes: Object.keys(attrs).length > 0 ? attrs : {},
            },
          };

          const transitions = [...cfg.transitions];
          if (existingIdx >= 0) {
            transitions[existingIdx] = entry;
          } else {
            transitions.push(entry);
          }
          persistConfig({ ...cfg, transitions });
        }

        closeDialog();
      } else {
        setError(result.error.message);
        setErrorDetails(result.error.details ?? null);
      }
    } catch {
      setError('Failed to fire transition. Please try again.');
    }
    setSubmitting(false);
  }, [activeTabId, domain, workflowKey, transitionName, isManualMode, manualTransitionName, instanceKey, tags, headerRows, globalHeaders, sessionHeaders, buildAttributes, pollState, closeDialog, configRef, persistConfig]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transition-dialog-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex w-[620px] max-h-[80vh] flex-col rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] shadow-lg focus:outline-none"
      >
        <header className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3">
          <h2 id="transition-dialog-title" className="text-sm font-semibold">
            {isManualMode ? 'Manual Transition' : `Transition: ${transitionName}`}
          </h2>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                  onClick={closeDialog}
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

        <div className="flex-1 overflow-y-auto p-4">
          {isManualMode && (
            <div className="mb-3 flex flex-col gap-1">
              <label className="text-xs font-medium">
                Transition Name <span className="text-[var(--vscode-errorForeground)]">*</span>
              </label>
              <input
                type="text"
                value={manualTransitionName}
                onChange={(e) => setManualTransitionName(e.target.value)}
                placeholder="Enter transition name"
                autoFocus
                className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
              />
              {!manualTransitionName.trim() && (
                <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                  Transition name is required to fire
                </p>
              )}
            </div>
          )}

          <TransitionViewInfo view={transitionView} loading={viewLoading} />

          <HeaderOverrideSection rows={headerRows} setRows={setHeaderRows} />

          <TransitionInputStep
            transitionName={transitionName}
            isManualMode={isManualMode}
            schema={schema}
            schemaLoading={schemaLoading}
            hasSchema={hasSchema}
            attributes={attributes}
            setAttributes={setAttributes}
            instanceKey={instanceKey}
            setInstanceKey={setInstanceKey}
            tags={tags}
            setTags={setTags}
            sync={sync}
            setSync={setSync}
          />

          {error && (
            <ValidationErrorBlock message={error} details={errorDetails ?? undefined} />
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <button
            className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={closeDialog}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting || schemaLoading || (isManualMode && !manualTransitionName.trim())}
          >
            {submitting ? 'Submitting...' : 'Fire Transition'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TransitionViewInfo({
  view,
  loading,
}: {
  view: ViewResponse | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mb-3 flex items-center justify-center rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-textCodeBlock-background)] py-3 text-xs text-[var(--vscode-descriptionForeground)]">
        <span className="animate-pulse">Loading transition view...</span>
      </div>
    );
  }

  if (!view) return null;

  const displayContent = safeViewContent(view.content);
  let jsonValue: unknown = null;
  try { jsonValue = JSON.parse(displayContent); } catch { /* not JSON */ }

  return (
    <div className="mb-3 rounded border border-[var(--vscode-panel-border)] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="font-medium">{view.key}</span>
        <span className="rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[9px] text-[var(--vscode-badge-foreground)]">
          {view.type}
        </span>
        {view.label && (
          <span className="text-[var(--vscode-descriptionForeground)]">{view.label}</span>
        )}
      </div>
      {jsonValue != null ? (
        <CopyableJsonBlock value={jsonValue} />
      ) : (
        <CopyableJsonBlock value={displayContent || '(empty)'} />
      )}
    </div>
  );
}

function TransitionInputStep({
  transitionName,
  isManualMode,
  schema,
  schemaLoading,
  hasSchema,
  attributes,
  setAttributes,
  instanceKey,
  setInstanceKey,
  tags,
  setTags,
  sync,
  setSync,
}: {
  transitionName: string;
  isManualMode: boolean;
  schema: SchemaResponse | null;
  schemaLoading: boolean;
  hasSchema: boolean;
  attributes: string;
  setAttributes: (v: string) => void;
  instanceKey: string;
  setInstanceKey: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  sync: boolean;
  setSync: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!isManualMode && (
        <div className="text-xs text-[var(--vscode-descriptionForeground)]">
          Firing transition <strong>{transitionName}</strong>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
          Advanced (Key, Tags, Sync)
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Key</label>
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
                onClick={() => setInstanceKey(crypto.randomUUID())}
                title="Generate UUID"
              >
                Generate
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2"
              className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={sync}
              onChange={(e) => setSync(e.target.checked)}
              className="rounded"
            />
            <span>Sync (wait for transition to complete)</span>
          </label>
        </div>
      </details>

      {schemaLoading && (
        <div className="flex items-center justify-center py-4 text-xs text-[var(--vscode-descriptionForeground)]">
          <span className="animate-pulse">Loading schema...</span>
        </div>
      )}

      {!schemaLoading && hasSchema && schema && (
        <SchemaFormRenderer
          schema={schema}
          value={attributes}
          onChange={setAttributes}
        />
      )}

      {!schemaLoading && (!hasSchema || !schema) && (
        <JsonEditorWithCopy
          label="Attributes (JSON)"
          value={attributes}
          onChange={setAttributes}
          rows={8}
        />
      )}
    </div>
  );
}

function SchemaFormRenderer({
  schema,
  value,
  onChange,
}: {
  schema: SchemaResponse;
  value: string;
  onChange: (v: string) => void;
}) {
  const schemaDef = schema.schema as {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
    title?: string;
    description?: string;
  };

  const properties = schemaDef.properties ?? {};
  const required = new Set(schemaDef.required ?? []);

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(value) as Record<string, unknown>;
  } catch { /* keep empty */ }

  const [showRaw, setShowRaw] = useState(false);

  const updateField = (key: string, fieldValue: unknown) => {
    const next = { ...parsed, [key]: fieldValue };
    onChange(JSON.stringify(next, null, 2));
  };

  if (showRaw) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-end">
          <button
            className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
            onClick={() => setShowRaw(false)}
          >
            Switch to Form
          </button>
        </div>
        <JsonEditorWithCopy
          label="Attributes (JSON)"
          value={value}
          onChange={onChange}
          rows={8}
        />
      </div>
    );
  }

  const propEntries = Object.entries(properties);

  if (propEntries.length === 0) {
    return (
      <JsonEditorWithCopy
        label="Attributes (JSON)"
        value={value}
        onChange={onChange}
        rows={8}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          {schemaDef.title && <p className="text-xs font-semibold">{schemaDef.title}</p>}
          {schemaDef.description && (
            <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">{schemaDef.description}</p>
          )}
        </div>
        <button
          className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={() => setShowRaw(true)}
        >
          Switch to JSON
        </button>
      </div>

      {propEntries.map(([key, prop]) => (
        <SchemaField
          key={key}
          name={key}
          prop={prop}
          required={required.has(key)}
          value={parsed[key]}
          onChange={(v) => updateField(key, v)}
        />
      ))}
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
    <details className="mb-3 text-xs">
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

interface JsonSchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  oneOf?: Array<{ const: string; description?: string }>;
  enum?: string[];
  default?: unknown;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

function SchemaField({
  name,
  prop,
  required,
  value,
  onChange,
}: {
  name: string;
  prop: JsonSchemaProperty;
  required: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = prop.title ?? name;
  const isSelect = prop.oneOf && prop.oneOf.length > 0;
  const isEnum = prop.enum && prop.enum.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-[var(--vscode-errorForeground)]">*</span>}
      </label>
      {prop.description && (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">{prop.description}</p>
      )}
      {isSelect ? (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)]"
        >
          <option value="">-- Select --</option>
          {prop.oneOf!.map((opt) => (
            <option key={opt.const} value={opt.const}>
              {opt.description ?? opt.const}
            </option>
          ))}
        </select>
      ) : isEnum ? (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)]"
        >
          <option value="">-- Select --</option>
          {prop.enum!.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : prop.type === 'object' && prop.properties ? (
        <fieldset className="ml-2 flex flex-col gap-2 border-l-2 border-[var(--vscode-panel-border)] pl-3">
          {Object.entries(prop.properties).map(([nestedKey, nestedProp]) => (
            <SchemaField
              key={nestedKey}
              name={nestedKey}
              prop={nestedProp}
              required={prop.required?.includes(nestedKey) ?? false}
              value={(value as Record<string, unknown> | undefined)?.[nestedKey]}
              onChange={(v) => {
                const obj = (value as Record<string, unknown>) ?? {};
                onChange({ ...obj, [nestedKey]: v });
              }}
            />
          ))}
        </fieldset>
      ) : prop.type === 'boolean' ? (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          {label}
        </label>
      ) : prop.type === 'number' || prop.type === 'integer' ? (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)]"
        />
      ) : (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
        />
      )}
    </div>
  );
}
