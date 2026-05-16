import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

import { ResizableDialogShell } from '../../../ui/ResizableDialogShell';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';
import { SchemaForm, validateAgainstSchema } from '../../schema-form';
import type { JsonSchemaRoot } from '../../schema-form';
import * as QuickRunApi from '../QuickRunApi';
import type { PresetEntry, WorkflowBucketConfig } from '../QuickRunApi';
import { useQuickRunPolling } from '../hooks/useQuickRunPolling';
import { useQuickRunStore } from '../store/quickRunStore';
import { safeViewContent, type SchemaResponse, type ViewResponse } from '../types/quickrun.types';
import { CopyableJsonBlock } from './CopyableJsonBlock';
import { ValidationErrorBlock } from './ValidationErrorBlock';

interface TransitionDialogProps {
  configRef: MutableRefObject<WorkflowBucketConfig>;
  persistConfig: (cfg: WorkflowBucketConfig) => void;
  /**
   * Project id — required for the test-data + presets backends. When
   * absent (e.g. quickrun launched from a context that hasn't
   * resolved the project yet), the manual JSON edit still works but
   * the Presets dropdown stays hidden.
   */
  projectId?: string;
}

export function TransitionDialog({ configRef, persistConfig, projectId }: TransitionDialogProps) {
  const open = useQuickRunStore((s) => s.transitionDialogOpen);
  const transition = useQuickRunStore((s) => s.transitionDialogTarget);
  const closeDialog = useQuickRunStore((s) => s.closeTransitionDialog);
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const sessionHeaders = useQuickRunStore((s) => s.sessionHeaders);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);

  const { pollState } = useQuickRunPolling(pollingConfig);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [transitionView, setTransitionView] = useState<ViewResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [attributes, setAttributes] = useState('{}');
  const [instanceKey, setInstanceKey] = useState('');
  const [stage, setStage] = useState('');
  const [tags, setTags] = useState('');
  const [headerRows, setHeaderRows] = useState<{ name: string; value: string }[]>([]);
  const [sync, setSync] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null);
  const [manualTransitionName, setManualTransitionName] = useState('');
  const [updateConfig, setUpdateConfig] = useState(true);
  // Submit-time validation gate. Errors stay hidden until the user
  // presses Fire Transition; on the first failed attempt every required
  // / pattern violation lights up at once so the user sees the full
  // picture instead of one-by-one.
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ─── Presets ─────────────────────────────────────────────────────
  // Saved attribute payloads, scoped to (projectId, workflowKey) per
  // the existing quickrun-presets backend. The same pool is shared
  // with `NewRunDialog`, so users with both start-instance and
  // transition payloads should name presets descriptively
  // (e.g. "approve-default", "reject-fraud"). Per-transition scoping
  // would require a backend change and is not done here.
  const [presets, setPresets] = useState<PresetEntry[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [savePresetMode, setSavePresetMode] = useState<{ name: string; description: string } | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);

  const isManualMode = open && transition === null;
  const transitionName = isManualMode ? manualTransitionName : (transition?.name ?? '');
  const hasSchema = transition?.schema?.hasSchema ?? false;
  const hasView = transition?.view?.hasView ?? false;
  const canPresets = Boolean(projectId && workflowKey);

  useEffect(() => {
    if (!open || !activeTabId) return;

    setSchema(null);
    setTransitionView(null);
    setAttributes('{}');
    setInstanceKey('');
    setStage('');
    setTags('');
    setError(null);
    setErrorDetails(null);
    setSubmitting(false);
    setManualTransitionName('');
    setSubmitAttempted(false);

    const inherited = { ...globalHeaders, ...sessionHeaders };
    const rows: { name: string; value: string }[] = Object.entries(inherited).map(([name, value]) => ({ name, value }));

    if (transition) {
      const savedTransition = configRef.current.transitions.find((t) => t.key === transition.name);
      if (savedTransition) {
        if (savedTransition.body?.key) setInstanceKey(savedTransition.body.key);
        if (savedTransition.body?.stage) setStage(savedTransition.body.stage);
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
        runtimeUrl: environmentUrl,
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

  // ─── Preset callbacks ────────────────────────────────────────────
  const refreshPresets = useCallback(async () => {
    if (!canPresets || !projectId) return;
    const result = await QuickRunApi.listPresets({ projectId, workflowKey });
    if (result.success) setPresets(result.data.presets);
  }, [canPresets, projectId, workflowKey]);

  const handlePresetSelect = useCallback(
    async (id: string) => {
      setSelectedPresetId(id);
      setPresetError(null);
      if (!id || !projectId) return;
      const result = await QuickRunApi.getPreset({ projectId, workflowKey, presetId: id });
      if (!result.success || !result.data.preset) return;
      setAttributes(JSON.stringify(result.data.preset.payload, null, 2));
    },
    [projectId, workflowKey],
  );

  const handleSavePreset = useCallback(async () => {
    if (!savePresetMode || !projectId) return;
    let payload: unknown;
    try {
      payload = JSON.parse(attributes);
    } catch {
      setPresetError('Cannot save preset — attributes JSON is invalid.');
      return;
    }
    const result = await QuickRunApi.savePreset({
      projectId,
      workflowKey,
      data: {
        name: savePresetMode.name,
        ...(savePresetMode.description ? { description: savePresetMode.description } : {}),
        payload,
      },
    });
    if (!result.success) {
      setPresetError(result.error.message);
      return;
    }
    setSavePresetMode(null);
    setSelectedPresetId(result.data.preset.id);
    setPresetError(null);
    void refreshPresets();
  }, [attributes, projectId, refreshPresets, savePresetMode, workflowKey]);

  const handleDeletePreset = useCallback(async () => {
    if (!selectedPresetId || !projectId) return;
    if (!window.confirm('Delete this preset?')) return;
    const result = await QuickRunApi.deletePreset({ projectId, workflowKey, presetId: selectedPresetId });
    if (!result.success) {
      setPresetError(result.error.message);
      return;
    }
    setSelectedPresetId('');
    void refreshPresets();
  }, [projectId, refreshPresets, selectedPresetId, workflowKey]);

  // Refresh presets whenever the dialog opens for a project+workflow
  // pair. Cheap; the list is small and indexed by file path on disk.
  useEffect(() => {
    if (!open) return;
    setSelectedPresetId('');
    setSavePresetMode(null);
    setPresetError(null);
    void refreshPresets();
  }, [open, refreshPresets]);

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

    // Submit-time schema validation. Only runs when the transition
    // exposes a resolved schema (otherwise the user is on the JSON
    // editor path, and the runtime will still reject malformed input).
    // First failed attempt flips `submitAttempted` so the form shows
    // every error at once instead of one-by-one.
    if (hasSchema && schema) {
      const issues = validateAgainstSchema(schema.schema as JsonSchemaRoot, attrs);
      const issueCount = Object.keys(issues).length;
      if (issueCount > 0) {
        setSubmitAttempted(true);
        const [firstPath, firstMessages] = Object.entries(issues)[0];
        setError(
          issueCount === 1
            ? `${firstPath || 'payload'}: ${firstMessages.join(', ')}`
            : `${firstPath || 'payload'}: ${firstMessages.join(', ')} (+${
                issueCount - 1
              } more)`,
        );
        setSubmitting(false);
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

      const result = await QuickRunApi.fireTransition({
        domain,
        workflowKey,
        instanceId: activeTabId,
        transitionKey: transitionName,
        sync,
        key: instanceKey || undefined,
        stage: stage.trim() || undefined,
        tags: tagsList.length > 0 ? tagsList : undefined,
        attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
        headers: mergedHeaders,
        runtimeUrl: environmentUrl,
      });

      if (result.success) {
        void pollState({
          domain,
          workflowKey,
          instanceId: activeTabId,
          headers: mergedHeaders,
          runtimeUrl: environmentUrl,
        });

        if (updateConfig && !isManualMode) {
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
              stage: stage.trim() || undefined,
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
  }, [activeTabId, domain, workflowKey, transitionName, isManualMode, manualTransitionName, instanceKey, stage, tags, headerRows, globalHeaders, sessionHeaders, environmentUrl, buildAttributes, pollState, closeDialog, configRef, persistConfig, hasSchema, schema, sync, updateConfig]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <ResizableDialogShell
        containerRef={dialogRef}
        defaultWidth={620}
        defaultHeight={Math.min(720, Math.round(window.innerHeight * 0.8))}
        storageKey="vnext-forge.dialog.transition"
        ariaLabelledBy="transition-dialog-title"
      >
        <header
          data-dialog-handle="drag"
          className="flex select-none items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3"
          style={{ cursor: 'move' }}
        >
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

          <TransitionAnnotations annotations={transition?.annotations} />

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
            stage={stage}
            setStage={setStage}
            tags={tags}
            setTags={setTags}
            sync={sync}
            setSync={setSync}
            submitAttempted={submitAttempted}
            // Presets — wired only when projectId+workflowKey are known.
            // When `canPresets` is false the dropdown stays hidden.
            canPresets={canPresets}
            presets={presets}
            selectedPresetId={selectedPresetId}
            onPresetSelect={handlePresetSelect}
            onPresetDelete={handleDeletePreset}
            savePresetMode={savePresetMode}
            onOpenSavePreset={() => setSavePresetMode({ name: '', description: '' })}
            onCancelSavePreset={() => setSavePresetMode(null)}
            onChangeSavePresetName={(name) =>
              setSavePresetMode((s) => (s ? { ...s, name } : s))
            }
            onChangeSavePresetDescription={(description) =>
              setSavePresetMode((s) => (s ? { ...s, description } : s))
            }
            onConfirmSavePreset={handleSavePreset}
            presetError={presetError}
          />

          {error && (
            <ValidationErrorBlock message={error} details={errorDetails ?? undefined} />
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--vscode-panel-border)] px-4 py-3">
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--vscode-descriptionForeground)]" title="When checked, the current values will be saved for future transitions">
            <input type="checkbox" checked={updateConfig} onChange={(e) => setUpdateConfig(e.target.checked)} className="rounded" />
            Update saved config
          </label>
          <div className="flex gap-2">
            <button
              className="rounded border border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
              onClick={closeDialog}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
              onClick={() => void handleSubmit()}
              disabled={submitting || schemaLoading || (isManualMode && !manualTransitionName.trim())}
            >
              {submitting ? 'Submitting...' : 'Fire Transition'}
            </button>
          </div>
        </footer>
      </ResizableDialogShell>
    </div>
  );
}

function TransitionAnnotations({ annotations }: { annotations?: Record<string, string> }) {
  if (!annotations) return null;
  const entries = Object.entries(annotations);
  if (entries.length === 0) return null;

  return (
    <details className="mb-3 text-xs">
      <summary className="cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
        Annotations ({entries.length})
      </summary>
      <div className="mt-1.5 max-h-24 overflow-y-auto rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-textCodeBlock-background)]">
        <div className="flex flex-col divide-y divide-[var(--vscode-panel-border)]">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-2 px-2.5 py-1">
              <span className="shrink-0 font-medium text-[10px] text-[var(--vscode-foreground)]">{key}</span>
              <span className="truncate text-[10px] text-[var(--vscode-descriptionForeground)]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function TransitionViewInfo({
  view,
  loading,
}: {
  view: ViewResponse | null;
  loading: boolean;
}) {
  const [collapsed, setCollapsed] = useState(true);

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
    <div className="mb-3 rounded border border-[var(--vscode-panel-border)]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">{view.key}</span>
          <span className="rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[9px] text-[var(--vscode-badge-foreground)]">
            {view.type}
          </span>
          {view.renderer && (
            <span className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-textCodeBlock-background)] px-1 py-0.5 text-[9px] text-[var(--vscode-descriptionForeground)]">
              {view.renderer}
            </span>
          )}
          {view.label && (
            <span className="text-[var(--vscode-descriptionForeground)]">{view.label}</span>
          )}
        </div>
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed && (
        <div className="border-t border-[var(--vscode-panel-border)] p-3">
          {jsonValue != null ? (
            <CopyableJsonBlock value={jsonValue} />
          ) : (
            <CopyableJsonBlock value={displayContent || '(empty)'} />
          )}
        </div>
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
  stage,
  setStage,
  tags,
  setTags,
  sync,
  setSync,
  submitAttempted,
  canPresets,
  presets,
  selectedPresetId,
  onPresetSelect,
  onPresetDelete,
  savePresetMode,
  onOpenSavePreset,
  onCancelSavePreset,
  onChangeSavePresetName,
  onChangeSavePresetDescription,
  onConfirmSavePreset,
  presetError,
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
  stage: string;
  setStage: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  sync: boolean;
  setSync: (v: boolean) => void;
  submitAttempted: boolean;
  canPresets: boolean;
  presets: PresetEntry[];
  selectedPresetId: string;
  onPresetSelect: (id: string) => void;
  onPresetDelete: () => void;
  savePresetMode: { name: string; description: string } | null;
  onOpenSavePreset: () => void;
  onCancelSavePreset: () => void;
  onChangeSavePresetName: (v: string) => void;
  onChangeSavePresetDescription: (v: string) => void;
  onConfirmSavePreset: () => void;
  presetError: string | null;
}) {
  // Faker-driven payload generation. Mirrors `NewRunDialog` but uses the
  // generic `test-data/generate` endpoint with the schema already in
  // hand (transition's schema is fetched from the runtime, not from a
  // project file). Each press fires with a fresh `Date.now()` seed so
  // consecutive clicks visibly produce different payloads.
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const canGenerateAttributes =
    hasSchema && !schemaLoading && Boolean(schema) && typeof schema?.schema === 'object';

  const handleGenerate = useCallback(async () => {
    if (!schema?.schema || typeof schema.schema !== 'object') return;
    setGenerating(true);
    setGenError(null);
    try {
      const result = await QuickRunApi.generateForSchema({
        schema: schema.schema as Record<string, unknown>,
        options: { seed: Date.now() },
      });
      if (!result.success) {
        setGenError(result.error.message);
        return;
      }
      setAttributes(JSON.stringify(result.data.instance, null, 2));
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }, [schema, setAttributes]);

  const handleClear = useCallback(() => setAttributes('{}'), [setAttributes]);

  const handlePaste = useCallback(async () => {
    setGenError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      try {
        const parsed = JSON.parse(text);
        setAttributes(JSON.stringify(parsed, null, 2));
      } catch {
        setAttributes(text);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Paste failed');
    }
  }, [setAttributes]);
  return (
    <div className="flex flex-col gap-3">
      {!isManualMode && (
        <div className="text-xs text-[var(--vscode-descriptionForeground)]">
          Firing transition <strong>{transitionName}</strong>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]">
          Advanced (Key, Stage, Tags, Sync)
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
            <label className="text-xs font-medium">Stage</label>
            <input
              type="text"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              placeholder="e.g. approval, review, payment"
              className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
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

      {!schemaLoading && (
        <div className="flex flex-col gap-1.5">
          {/*
           * Attribute toolbar — Clear / Paste are always available
           * since they help any free-form JSON edit; Generate only
           * shows up when the transition exposes a resolved schema
           * (faker needs structure). Each Generate click feeds a
           * fresh seed so consecutive presses produce different
           * payloads.
           */}
          <div className="flex items-center gap-1 flex-wrap">
            {generating ? (
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                generating…
              </span>
            ) : null}
            {canGenerateAttributes ? (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
                title="Generate a fresh faker-driven payload from this transition's schema (re-click for a new payload)"
              >
                ✨ Generate
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClear}
              className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
              title="Clear attributes back to {}"
            >
              🗑 Clear
            </button>
            <button
              type="button"
              onClick={() => void handlePaste()}
              className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
              title="Paste from clipboard (auto-formats JSON)"
            >
              📋 Paste
            </button>

            {/*
             * Preset dropdown — mirrors NewRunDialog. Lets the user
             * load a previously-saved payload directly into the
             * attributes field, and save the current payload as a
             * new preset. Scoped to (projectId, workflowKey).
             */}
            {canPresets ? (
              <>
                <select
                  value={selectedPresetId}
                  onChange={(e) => onPresetSelect(e.target.value)}
                  className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-input-foreground)]"
                  title="Load a saved preset payload"
                >
                  <option value="">— Preset —</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {selectedPresetId ? (
                  <button
                    type="button"
                    onClick={onPresetDelete}
                    className="rounded border border-[var(--vscode-panel-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                    title="Delete selected preset"
                  >
                    🗑
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onOpenSavePreset}
                  className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                  title="Save current attributes as a named preset"
                >
                  💾 Save
                </button>
              </>
            ) : null}

            {!canGenerateAttributes && hasSchema ? null : !canGenerateAttributes ? (
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)] ml-1">
                No schema attached — manual edit only
              </span>
            ) : null}
            {genError ? (
              <span
                role="alert"
                className="text-[10px] text-[var(--vscode-errorForeground)] ml-1"
              >
                {genError}
              </span>
            ) : null}
            {presetError ? (
              <span
                role="alert"
                className="text-[10px] text-[var(--vscode-errorForeground)] ml-1"
              >
                {presetError}
              </span>
            ) : null}
          </div>

          {/* Inline save-preset form — collapsed by default. */}
          {savePresetMode ? (
            <div className="flex flex-col gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-list-hoverBackground)]/30 p-2">
              <div className="text-[11px] font-semibold">Save preset</div>
              <input
                type="text"
                value={savePresetMode.name}
                onChange={(e) => onChangeSavePresetName(e.target.value)}
                placeholder="Preset name (e.g. Approve-default)"
                className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-input-foreground)]"
                autoFocus
              />
              <input
                type="text"
                value={savePresetMode.description}
                onChange={(e) => onChangeSavePresetDescription(e.target.value)}
                placeholder="Description (optional)"
                className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-input-foreground)]"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={onCancelSavePreset}
                  className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirmSavePreset}
                  disabled={!savePresetMode.name.trim()}
                  className="rounded border border-[var(--vscode-button-border)] bg-[var(--vscode-button-background)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          ) : null}

          <SchemaForm
            schema={
              hasSchema && schema
                ? (schema.schema as JsonSchemaRoot)
                : null
            }
            value={attributes}
            onChange={setAttributes}
            jsonEditorLabel="Attributes (JSON)"
            jsonEditorRows={12}
            showAllErrors={submitAttempted}
          />
        </div>
      )}
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

// `JsonSchemaProperty` + `SchemaField` previously lived here as an inline
// renderer. They are now centralized in `../../schema-form/` and consumed
// via `<SchemaForm>` so other dialogs (NewRunDialog, future component
// metadata editors) can share the same widget set + extension surface.
