import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ViewRenderer, ViewType } from '@vnext-forge-studio/vnext-types';
import { LabelEditor } from '../../modules/save-component/components/LabelEditor';
import { getViewEditorFieldError } from '../../modules/view-editor/ViewEditorSchema';
import {
  MetadataEditableTextInput,
  MetadataLockedTextInput,
} from '../component-metadata';
import { PseudoUiViewSurface } from '../quick-run/pseudo-ui/PseudoUiViewSurface';
import type { ViewResponse } from '../quick-run/types/quickrun.types';
import { ConfirmAlertDialog } from '../../ui/AlertDialog';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { ComponentDescriptionField } from '../../ui/ComponentDescriptionField';
import { Field } from '../../ui/Field';
import { JsonCodeField } from '../../ui/JsonCodeField';
import { TagEditor } from '../../ui/TagEditor';
import { ComponentValidationSummary } from '../save-component/components/ComponentValidationSummary';
import { ViewDisplayStrategyPicker } from './components/ViewDisplayStrategyPicker';
import { ViewRendererPicker } from './components/ViewRendererPicker';
import { ViewTypePicker } from './components/ViewTypePicker';
import { HrefUrnField } from './components/HrefUrnField';
import { PseudoUiBuilder } from './components/builder/PseudoUiBuilder';
import { buildSchemaLoader, type SchemaLoader } from './components/builder/utils/buildSchemaLoader';
import { buildVnextResUrnFromComponent } from './components/builder/utils/buildVnextResUrn';
import { discoverVnextComponentsByCategory } from '../vnext-workspace/vnextComponentDiscovery';
import { useProjectStore } from '../../store/useProjectStore';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import {
  viewTypeToMonacoLanguage,
  scaffoldContentForViewType,
  isContentEmpty,
  isLinkType,
  normalizeContentForEditor,
} from './viewContentHelpers';

interface ViewEditorPanelProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

const VIEW_TYPE_LABELS: Record<number, string> = {
  [ViewType.Json]: 'JSON',
  [ViewType.Html]: 'HTML',
  [ViewType.Markdown]: 'Markdown',
  [ViewType.DeepLink]: 'Deep Link',
  [ViewType.Http]: 'HTTP',
  [ViewType.URN]: 'URN',
};

const PREVIEW_SHELL =
  'min-h-[280px] max-h-[min(560px,60vh)] w-full overflow-auto rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3';

function unknownToUiString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

interface JsonEditorToolbarProps {
  onBeautify: () => void;
  onMinify: () => void;
  errorMsg: string | null;
}

function JsonEditorToolbar({ onBeautify, onMinify, errorMsg }: JsonEditorToolbarProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 min-h-7 px-2 text-[11px]"
          onClick={onBeautify}
        >
          Beautify
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 min-h-7 px-2 text-[11px]"
          onClick={onMinify}
        >
          Minify
        </Button>
      </div>
      {errorMsg ? (
        <p className="text-[11px] text-[var(--vscode-errorForeground)]" role="status">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}

function StaticJsonPreview({ text }: { text: string }) {
  const formatted = useMemo(() => {
    const t = text.trim();
    if (t === '') return '';
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return text;
    }
  }, [text]);

  return (
    <div className={PREVIEW_SHELL}>
      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--vscode-foreground)]">
        {formatted}
      </pre>
    </div>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  return (
    <div
      className={`${PREVIEW_SHELL} text-[var(--vscode-foreground)] [&_a]:text-[var(--vscode-textLink-foreground)] [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--vscode-textCodeBlock-background)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[11px] [&_h1]:mb-2 [&_h1]:text-[1rem] [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-[13px] [&_h2]:font-semibold [&_li]:my-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-[var(--vscode-textCodeBlock-background)] [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[11px] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ''}</ReactMarkdown>
    </div>
  );
}

export function ViewEditorPanel({ json, onChange }: ViewEditorPanelProps) {
  const [pendingType, setPendingType] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [jsonActionError, setJsonActionError] = useState<string | null>(null);

  // R16.1: workspace Schemas discovery for the pseudo-ui builder. Only
  // populated when we actually need it (renderer = pseudo-ui) and a
  // project is active. Both the inspector's bind autocomplete + lookups
  // picker and the SDK preview / canvas surface consume the resolved
  // schema (via `loadSchema`).
  const activeProject = useProjectStore((s) => s.activeProject);
  const [discoveredSchemas, setDiscoveredSchemas] = useState<readonly DiscoveredVnextComponent[]>([]);
  // R26.S1 — workspace discovery is async. Track completion so the
  // SDK Frame never mounts with a half-baked `loadSchema` (would lock
  // the pseudo-ui form context onto an empty `{}` schema per R22.2).
  // `false` = discovery still in flight; `true` = done (list may
  // legitimately be empty, e.g. no schemas in workspace).
  const [discoveryReady, setDiscoveryReady] = useState(false);

  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const currentType = Number(attrs.type ?? ViewType.Json);
  const version = unknownToUiString(json.version);
  const domain = unknownToUiString(json.domain);
  const flow = unknownToUiString(json.flow);
  const versionError = getViewEditorFieldError('version', version);
  const domainError = getViewEditorFieldError('domain', domain);
  const flowError = getViewEditorFieldError('flow', flow);

  const monacoLanguage = viewTypeToMonacoLanguage(currentType);
  const contentValue = normalizeContentForEditor(attrs.content, currentType);

  const rendererAttr = unknownToUiString(attrs.renderer);

  const displayAttr = unknownToUiString(attrs.display);
  const displayStrategyValue = displayAttr === '' ? 'full-page' : displayAttr;

  const isJsonComponentType = currentType === Number(ViewType.Json);

  const showContentPreviewToggle = !isLinkType(currentType);

  const pseudoUiParse = useMemo(() => {
    try {
      const t = contentValue.trim();
      if (!t) return { ok: false as const };
      const obj = JSON.parse(t) as unknown;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false as const };
      return { ok: true as const, obj: obj as Record<string, unknown> };
    } catch {
      return { ok: false as const };
    }
  }, [contentValue]);

  const pseudoUiViewResponse = useMemo((): ViewResponse | null => {
    if (!pseudoUiParse.ok) return null;
    return {
      key: unknownToUiString(json.key) || 'preview',
      content: pseudoUiParse.obj,
      type: 'Json',
      renderer: ViewRenderer.PseudoUi,
    };
  }, [pseudoUiParse, json.key]);

  // Discovery: only fires when the renderer is pseudo-ui *and* a
  // project is active. We re-discover when the active project id
  // changes (workspace switch). For schema files mutated in place we
  // rely on the user reloading — schema cache invalidation on
  // `workspace-fs-events` is deferred (out of plan).
  const isPseudoUi = isJsonComponentType && rendererAttr === String(ViewRenderer.PseudoUi);
  const activeProjectId = activeProject?.id;
  const activeProjectPath = activeProject?.path;
  useEffect(() => {
    if (!isPseudoUi || !activeProjectId) {
      setDiscoveredSchemas([]);
      // Mark ready so the placeholder gate releases — there is nothing
      // to discover when the renderer isn't pseudo-ui or no project is
      // active. Surfaces still mount; they just have nothing to
      // resolve URNs against (and most won't even ask).
      setDiscoveryReady(true);
      return;
    }
    setDiscoveryReady(false);
    let cancelled = false;
    void discoverVnextComponentsByCategory(activeProjectId, 'schemas')
      .then((list) => {
        if (!cancelled) setDiscoveredSchemas(list);
      })
      .catch(() => {
        if (!cancelled) setDiscoveredSchemas([]);
      })
      .finally(() => {
        if (!cancelled) setDiscoveryReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isPseudoUi, activeProjectId]);

  const availableSchemas = useMemo(() => {
    return discoveredSchemas.map((c) => ({
      urn: buildVnextResUrnFromComponent('schema', c, activeProjectPath),
      label: c.version ? `${c.key} (v${c.version})` : c.key,
    }));
  }, [discoveredSchemas, activeProjectPath]);

  const loadSchema = useMemo<SchemaLoader | undefined>(() => {
    // Hold the loader undefined while discovery is in flight so the
    // SDK Frame doesn't mount against an empty schemas index (the
    // form context locks onto whatever schema lands on first mount).
    if (!discoveryReady) return undefined;
    return buildSchemaLoader({ schemas: discoveredSchemas, projectPath: activeProjectPath });
  }, [discoveryReady, discoveredSchemas, activeProjectPath]);

  useEffect(() => {
    setPreviewMode(false);
  }, [currentType]);

  useEffect(() => {
    if (!jsonActionError) return;
    const id = window.setTimeout(() => setJsonActionError(null), 2600);
    return () => window.clearTimeout(id);
  }, [jsonActionError]);

  useEffect(() => {
    if (currentType !== Number(ViewType.Json)) return;
    const raw = attrs.content;
    if (typeof raw !== 'string') return;
    const t = raw.trim();
    if (t === '') return;
    try {
      const parsed = parseJson(t);
      if (parsed === null || typeof parsed !== 'object') return;
      onChange((draft) => {
        draft.attributes ??= {};
        (draft.attributes as Record<string, unknown>).content = parsed;
      });
    } catch {
      // Not parseable legacy JSON wrapper — leave as authored string
    }
  }, [attrs.content, currentType, onChange]);

  const applyTypeChange = useCallback(
    (nextType: number) => {
      onChange((draft) => {
        draft.attributes ??= {};
        const a = draft.attributes as Record<string, unknown>;
        a.type = nextType;
        a.content = scaffoldContentForViewType(nextType);
      });
    },
    [onChange],
  );

  const handleTypeChange = useCallback(
    (nextType: number) => {
      if (nextType === currentType) return;

      if (isContentEmpty(contentValue)) {
        applyTypeChange(nextType);
      } else {
        setPendingType(nextType);
      }
    },
    [currentType, contentValue, applyTypeChange],
  );

  const handleContentChange = useCallback(
    (value: string) => {
      onChange((draft) => {
        draft.attributes ??= {};
        (draft.attributes as Record<string, unknown>).content = value;
      });
    },
    [onChange],
  );

  const handleBeautify = useCallback(() => {
    try {
      const trimmed = contentValue.trim();
      const parsed = trimmed === '' ? {} : parseJson(trimmed);
      const next = JSON.stringify(parsed, null, 2);
      handleContentChange(next);
      setJsonActionError(null);
    } catch {
      setJsonActionError('Invalid JSON — fix syntax before formatting.');
    }
  }, [contentValue, handleContentChange]);

  const handleMinify = useCallback(() => {
    try {
      const trimmed = contentValue.trim();
      const parsed = trimmed === '' ? {} : parseJson(trimmed);
      const next = JSON.stringify(parsed);
      handleContentChange(next);
      setJsonActionError(null);
    } catch {
      setJsonActionError('Invalid JSON — fix syntax before minifying.');
    }
  }, [contentValue, handleContentChange]);

  let previewBody: ReactNode;

  const viewKeyUi = unknownToUiString(json.key);

  if (isJsonComponentType && rendererAttr === String(ViewRenderer.PseudoUi)) {
    if (!discoveryReady) {
      // Hold the surface mount until workspace schema discovery
      // completes so the SDK form context inits against the right
      // schema (R22.2 race fix).
      previewBody = (
        <div className={PREVIEW_SHELL}>
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)]" role="status">
            Loading workspace schemas…
          </p>
        </div>
      );
    } else if (pseudoUiViewResponse) {
      previewBody = (
        <div className={PREVIEW_SHELL}>
          <PseudoUiViewSurface
            viewResponse={pseudoUiViewResponse}
            mode="preview"
            ariaLabel={`View preview ${viewKeyUi || 'untitled'}`}
            fillHeight={false}
            resolveSchema={loadSchema}
          />
        </div>
      );
    } else {
      previewBody = (
        <div className={PREVIEW_SHELL}>
          <p className="text-[11px] text-[var(--vscode-descriptionForeground)]" role="status">
            Enter a valid pseudo-ui JSON object to see the preview.
          </p>
        </div>
      );
    }
  } else if (currentType === Number(ViewType.Html)) {
    previewBody = (
      <div
        className={PREVIEW_SHELL}
        style={{ isolation: 'isolate' }}
        dangerouslySetInnerHTML={{ __html: contentValue }}
      />
    );
  } else if (currentType === Number(ViewType.Markdown)) {
    previewBody = <MarkdownPreview text={contentValue} />;
  } else if (currentType === Number(ViewType.Json)) {
    previewBody = <StaticJsonPreview text={contentValue} />;
  } else {
    previewBody = (
      <div className={PREVIEW_SHELL}>
        <p className="text-[11px] text-[var(--vscode-descriptionForeground)]" role="status">
          Preview is unavailable for this content type.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <ComponentValidationSummary />
      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">View Metadata</CardTitle>
          <CardDescription className="text-xs">Identity and flow bindings.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Key">
                <MetadataEditableTextInput
                  value={unknownToUiString(json.key)}
                  onChange={(e) => onChange((draft) => { draft.key = e.target.value; })}
                />
              </Field>
              <Field label="Version" errorMsg={versionError}>
                <MetadataEditableTextInput
                  value={version}
                  onChange={(e) => onChange((draft) => { draft.version = e.target.value; })}
                  aria-invalid={Boolean(versionError)}
                />
              </Field>
              <Field label="Domain" errorMsg={domainError}>
                <MetadataLockedTextInput value={domain} aria-invalid={Boolean(domainError)} />
              </Field>
              <Field label="Flow" errorMsg={flowError}>
                <MetadataLockedTextInput value={flow} aria-invalid={Boolean(flowError)} />
              </Field>
            </div>
            <Field label="Labels">
              <LabelEditor
                labels={(attrs.labels as { language: string; label: string }[]) ?? []}
                onChange={(labels) =>
                  onChange((draft) => {
                    draft.attributes ??= {};
                    (draft.attributes as Record<string, unknown>).labels = labels;
                  })
                }
              />
            </Field>
            <Field label="Tags">
              <TagEditor
                tags={(json.tags as string[]) ?? []}
                onChange={(tags) => onChange((draft) => { draft.tags = tags; })}
              />
            </Field>
            <ComponentDescriptionField
              value={unknownToUiString(json._comment)}
              onChange={(value) => onChange((d) => { d._comment = value === '' ? undefined : value; })}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Display Strategy</CardTitle>
          <CardDescription className="text-xs">How the view is presented.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <ViewDisplayStrategyPicker
            value={displayStrategyValue}
            onChange={(strategy) =>
              onChange((draft) => {
                draft.attributes ??= {};
                (draft.attributes as Record<string, unknown>).display = strategy;
              })
            }
          />
        </CardContent>
      </Card>

      <Card variant="default" className="gap-3">
        <CardHeader className="border-border border-b">
          <CardTitle className="text-base">Content</CardTitle>
          <CardDescription className="text-xs">
            Choose what kind of payload this view carries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <Field label="Content Type">
            <ViewTypePicker value={currentType} onChange={handleTypeChange} />
          </Field>

          {isJsonComponentType && (
            <Field label="Renderer">
              <ViewRendererPicker
                value={rendererAttr}
                onChange={(renderer) =>
                  onChange((draft) => {
                    draft.attributes ??= {};
                    (draft.attributes as Record<string, unknown>).renderer =
                      renderer || undefined;
                  })
                }
              />
            </Field>
          )}

          {isLinkType(currentType) ? (
            <HrefUrnField
              viewType={currentType}
              value={contentValue}
              onChange={handleContentChange}
            />
          ) : isJsonComponentType && rendererAttr === String(ViewRenderer.PseudoUi) ? (
            !discoveryReady ? (
              // Hold the builder mount until schemas discovery
              // completes (same R22.2 race fix as the preview branch
              // above — SDK form context inits against the empty
              // schemas index otherwise and enum-driven inputs
              // render with zero options).
              <p
                className="px-3 py-2 text-[11px] text-[var(--vscode-descriptionForeground)]"
                role="status">
                Loading workspace schemas…
              </p>
            ) : (
              <PseudoUiBuilder
                content={contentValue}
                onContentChange={handleContentChange}
                viewKey={viewKeyUi || 'preview'}
                availableSchemas={availableSchemas}
                loadSchema={loadSchema}
                projectId={activeProject?.id}
              />
            )
          ) : (
            <>
              <div className="flex items-center justify-between">
                {isJsonComponentType && !previewMode ? (
                  <JsonEditorToolbar
                    onBeautify={handleBeautify}
                    onMinify={handleMinify}
                    errorMsg={jsonActionError}
                  />
                ) : (
                  <span />
                )}
                {showContentPreviewToggle ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 shrink-0 min-h-7 px-2 text-[11px]"
                    onClick={() => setPreviewMode((v) => !v)}
                    aria-pressed={previewMode}
                  >
                    {previewMode ? 'Content' : 'Preview'}
                  </Button>
                ) : null}
              </div>
              {previewMode ? (
                previewBody
              ) : (
                <JsonCodeField
                  value={contentValue}
                  onChange={handleContentChange}
                  language={monacoLanguage}
                  height={300}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmAlertDialog
        open={pendingType !== null}
        onOpenChange={(open) => { if (!open) setPendingType(null); }}
        tone="warning"
        title="Change content type?"
        description={`Switching to ${VIEW_TYPE_LABELS[pendingType ?? ViewType.Json]} will replace the current content with a template. This can be undone.`}
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingType !== null) {
            applyTypeChange(pendingType);
            setPendingType(null);
          }
        }}
      />
    </div>
  );
}
