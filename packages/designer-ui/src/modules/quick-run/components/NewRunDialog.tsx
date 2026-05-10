import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

import { ResizableDialogShell } from '../../../ui/ResizableDialogShell';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';
import { SchemaForm } from '../../schema-form';
import type { JsonSchemaRoot } from '../../schema-form';
import * as QuickRunApi from '../QuickRunApi';
import type { PresetEntry, SchemaReference, WorkflowBucketConfig } from '../QuickRunApi';
import { useQuickRunPolling } from '../hooks/useQuickRunPolling';
import { useQuickRunStore } from '../store/quickRunStore';
import { ValidationErrorBlock } from './ValidationErrorBlock';

interface NewRunDialogProps {
  open: boolean;
  onClose: () => void;
  configRef: MutableRefObject<WorkflowBucketConfig>;
  persistConfig: (cfg: WorkflowBucketConfig) => void;
  /**
   * Project id — required for the test-data + presets backends. When
   * absent (e.g. extension shell hasn't wired it yet) the dialog still
   * works for manual editing, but Generate / Presets buttons stay
   * disabled.
   */
  projectId?: string;
  /**
   * Workflow's `attributes.startTransition.schema` reference. When set,
   * the dialog auto-fills the attributes payload on open with a
   * faker-driven instance. Edit / Regenerate / Clear / Paste buttons let
   * the user iterate. When unset (no schema attached), the dialog falls
   * back to the previous behavior — empty `{}` attributes.
   */
  startSchemaRef?: SchemaReference;
}

export function NewRunDialog({
  open,
  onClose,
  configRef,
  persistConfig,
  projectId,
  startSchemaRef,
}: NewRunDialogProps) {
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const environmentName = useQuickRunStore((s) => s.environmentName);
  const environmentUrl = useQuickRunStore((s) => s.environmentUrl);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const addInstance = useQuickRunStore((s) => s.addInstance);
  const addTab = useQuickRunStore((s) => s.addTab);
  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);

  const { pollState } = useQuickRunPolling(pollingConfig);

  const [instanceKey, setInstanceKey] = useState('');
  const [stage, setStage] = useState('');
  const [tags, setTags] = useState('');
  const [attributes, setAttributes] = useState('{}');
  const [sync, setSync] = useState(true);
  const [version, setVersion] = useState('');
  const [headerRows, setHeaderRows] = useState<{ name: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null);

  // Test-data + presets state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetEntry[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [savePresetMode, setSavePresetMode] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const autoFilledOnceRef = useRef(false);
  // Resolved JSON Schema for the workflow's `startTransition.schema`.
  // The test-data backend echoes the schema alongside the faker instance
  // (`generateForSchemaReference` -> `{ instance, schema, ... }`). We
  // capture it here so SchemaForm can render a live form view next to
  // the JSON editor toggle.
  const [resolvedSchema, setResolvedSchema] = useState<JsonSchemaRoot | null>(null);

  const canGenerate = Boolean(projectId && startSchemaRef);
  const canPresets = Boolean(projectId && workflowKey);

  const generateKey = useCallback(() => {
    setInstanceKey(crypto.randomUUID());
  }, []);

  // Faker-driven start payload — used by both auto-fill (on open) and the
  // explicit Generate / Regenerate buttons. `seed` is only passed for
  // Regenerate so consecutive clicks produce visibly different output.
  // `setInstance: false` lets the auto-fill pass refresh the resolved
  // schema without overwriting attributes the user already has loaded
  // (e.g. from a saved preset or from `WorkflowBucketConfig`).
  const runGenerate = useCallback(
    async (opts: { seed?: number | string; setInstance?: boolean } = {}): Promise<void> => {
      if (!projectId || !startSchemaRef) return;
      const setInstance = opts.setInstance ?? true;
      setGenerating(true);
      setGenError(null);
      try {
        const result = await QuickRunApi.generateForSchemaReference({
          projectId,
          schemaRef: startSchemaRef,
          ...(opts.seed != null ? { options: { seed: opts.seed } } : {}),
        });
        if (!result.success) {
          setGenError(result.error.message);
          return;
        }
        if (setInstance) {
          setAttributes(JSON.stringify(result.data.instance, null, 2));
        }
        if (result.data.schema && typeof result.data.schema === 'object') {
          setResolvedSchema(result.data.schema as JsonSchemaRoot);
        }
      } catch (err) {
        setGenError(err instanceof Error ? err.message : 'Generate failed');
      } finally {
        setGenerating(false);
      }
    },
    [projectId, startSchemaRef],
  );

  const handlePaste = useCallback(async () => {
    setGenError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      // Best-effort pretty-print: if it parses as JSON, format it.
      try {
        const parsed = JSON.parse(text);
        setAttributes(JSON.stringify(parsed, null, 2));
      } catch {
        setAttributes(text);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Paste failed');
    }
  }, []);

  const refreshPresets = useCallback(async () => {
    if (!canPresets || !projectId) return;
    const result = await QuickRunApi.listPresets({ projectId, workflowKey });
    if (result.success) setPresets(result.data.presets);
  }, [canPresets, projectId, workflowKey]);

  const handlePresetSelect = useCallback(
    async (id: string) => {
      setSelectedPresetId(id);
      if (!id || !projectId) return;
      const result = await QuickRunApi.getPreset({
        projectId,
        workflowKey,
        presetId: id,
      });
      if (!result.success || !result.data.preset) return;
      setAttributes(JSON.stringify(result.data.preset.payload, null, 2));
    },
    [projectId, workflowKey],
  );

  const handleSavePreset = useCallback(async () => {
    if (!savePresetMode || !projectId) return;
    let parsedPayload: unknown;
    try {
      parsedPayload = attributes.trim() ? JSON.parse(attributes) : {};
    } catch {
      setGenError('Cannot save preset — attributes JSON is invalid.');
      return;
    }
    const result = await QuickRunApi.savePreset({
      projectId,
      workflowKey,
      data: {
        name: savePresetMode.name,
        ...(savePresetMode.description ? { description: savePresetMode.description } : {}),
        payload: parsedPayload,
      },
    });
    if (!result.success) {
      setGenError(result.error.message);
      return;
    }
    setSavePresetMode(null);
    setSelectedPresetId(result.data.preset.id);
    void refreshPresets();
  }, [attributes, projectId, refreshPresets, savePresetMode, workflowKey]);

  const handleDeletePreset = useCallback(async () => {
    if (!selectedPresetId || !projectId) return;
    if (!window.confirm('Delete this preset?')) return;
    const result = await QuickRunApi.deletePreset({
      projectId,
      workflowKey,
      presetId: selectedPresetId,
    });
    if (!result.success) {
      setGenError(result.error.message);
      return;
    }
    setSelectedPresetId('');
    void refreshPresets();
  }, [projectId, refreshPresets, selectedPresetId, workflowKey]);

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
        stage: stage.trim() || undefined,
        tags: tagsList.length > 0 ? tagsList : undefined,
        attributes: Object.keys(parsedAttributes).length > 0 ? parsedAttributes : undefined,
        headers: mergedHeaders,
        runtimeUrl: environmentUrl,
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
          label: result.data.key || (result.data.id ?? '').slice(0, 8),
        });

        void pollState({
          domain,
          workflowKey,
          instanceId: result.data.id,
          headers: mergedHeaders,
          runtimeUrl: environmentUrl,
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
              stage: stage.trim() || undefined,
              tags: tagsList.length > 0 ? tagsList : undefined,
              attributes: Object.keys(parsedAttributes).length > 0 ? parsedAttributes : {},
            },
          },
        };
        persistConfig(updated);

        onClose();
        setInstanceKey('');
        setStage('');
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
  }, [domain, workflowKey, instanceKey, stage, tags, attributes, sync, version, headerRows, globalHeaders, environmentName, environmentUrl, addInstance, addTab, pollState, onClose, configRef, persistConfig]);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    const cfg = configRef.current;
    const startCfg = cfg.start;

    if (startCfg.body?.key) setInstanceKey(startCfg.body.key);
    if (startCfg.body?.stage) setStage(startCfg.body.stage);
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

  // Reset the auto-fill flag (and schema cache) when the dialog closes so
  // reopening triggers a fresh auto-fill instead of leaving last
  // session's payload. The schema is also cleared so a workflow change
  // between opens doesn't leak its predecessor's form view.
  useEffect(() => {
    if (!open) {
      autoFilledOnceRef.current = false;
      setResolvedSchema(null);
    }
  }, [open]);

  // First-open auto-fill: when the dialog opens for a workflow with a
  // known start schema we always fetch the resolved schema (so the form
  // view has something to render) but only OVERWRITE attributes when the
  // editor is empty. If the user already has a payload (e.g. from
  // `WorkflowBucketConfig`), we keep theirs and only refresh the schema.
  useEffect(() => {
    if (!open) return;
    if (!canGenerate) return;
    if (autoFilledOnceRef.current) return;
    autoFilledOnceRef.current = true;
    const trimmed = attributes.trim();
    const hasUserPayload = trimmed.length > 0 && trimmed !== '{}';
    void runGenerate({ setInstance: !hasUserPayload });
  }, [open, canGenerate, attributes, runGenerate]);

  // Load saved presets when the dialog opens for a known workflow.
  useEffect(() => {
    if (!open) return;
    void refreshPresets();
  }, [open, refreshPresets]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <ResizableDialogShell
        containerRef={dialogRef}
        defaultWidth={620}
        defaultHeight={Math.min(720, Math.round(window.innerHeight * 0.8))}
        storageKey="vnext-forge.dialog.new-run"
        ariaLabelledBy="new-run-title"
      >
        <header
          data-dialog-handle="drag"
          className="flex select-none items-center justify-between border-b border-[var(--vscode-panel-border)] px-4 py-3"
          style={{ cursor: 'move' }}
        >
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

          {/* Stage */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Stage (optional)</label>
            <input
              type="text"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              placeholder="e.g. approval, review, payment"
              className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
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

          {/* Attributes — payload editor with test-data + presets toolbar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-medium">Attributes (JSON)</label>
              {generating ? (
                <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                  generating…
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                {/* Preset dropdown */}
                {canPresets ? (
                  <>
                    <select
                      value={selectedPresetId}
                      onChange={(e) => void handlePresetSelect(e.target.value)}
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
                        onClick={() => void handleDeletePreset()}
                        className="rounded border border-[var(--vscode-panel-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                        title="Delete selected preset"
                      >
                        🗑
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setSavePresetMode({ name: '', description: '' })
                      }
                      className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                      title="Save current attributes as a named preset"
                    >
                      💾 Save
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {/* Action buttons row */}
            <div className="flex items-center gap-1 flex-wrap">
              {canGenerate ? (
                <>
                  <button
                    type="button"
                    onClick={() => void runGenerate()}
                    disabled={generating}
                    className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
                    title="Generate a fresh faker-driven JSON instance from the workflow's start schema"
                  >
                    ✨ Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => void runGenerate({ seed: Date.now() })}
                    disabled={generating}
                    className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)] disabled:opacity-50"
                    title="Regenerate with a fresh random seed"
                  >
                    🔄 Regenerate
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setAttributes('{}')}
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
              {!canGenerate ? (
                <span className="text-[10px] text-[var(--vscode-descriptionForeground)] ml-1">
                  No start schema attached — manual edit only
                </span>
              ) : null}
            </div>

            {genError ? (
              <div
                role="alert"
                className="rounded border border-[var(--vscode-errorForeground)]/40 bg-[var(--vscode-errorForeground)]/10 px-2 py-1 text-[10px] text-[var(--vscode-errorForeground)]"
              >
                {genError}
              </div>
            ) : null}

            {/*
             * SchemaForm renders a schema-driven form when `resolvedSchema`
             * is available (workflow has a start schema) and falls back to
             * a JSON editor otherwise. The Form/JSON toggle is exposed by
             * the form itself, so users can switch back to raw JSON for
             * fast edits.
             */}
            <SchemaForm
              schema={resolvedSchema}
              value={attributes}
              onChange={setAttributes}
              jsonEditorLabel=""
              jsonEditorRows={8}
            />
          </div>

          {/* Save-preset inline form (collapsed-by-default) */}
          {savePresetMode ? (
            <div className="flex flex-col gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-list-hoverBackground)]/30 p-2">
              <div className="text-[11px] font-semibold">Save preset</div>
              <input
                type="text"
                value={savePresetMode.name}
                onChange={(e) =>
                  setSavePresetMode({ ...savePresetMode, name: e.target.value })
                }
                placeholder="Preset name (e.g. Happy path)"
                className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-input-foreground)]"
                autoFocus
              />
              <input
                type="text"
                value={savePresetMode.description}
                onChange={(e) =>
                  setSavePresetMode({ ...savePresetMode, description: e.target.value })
                }
                placeholder="Description (optional)"
                className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1 text-xs text-[var(--vscode-input-foreground)]"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setSavePresetMode(null)}
                  className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSavePreset()}
                  disabled={!savePresetMode.name.trim()}
                  className="rounded border border-[var(--vscode-button-border)] bg-[var(--vscode-button-background)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          ) : null}

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
      </ResizableDialogShell>
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
