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
import { PseudoUiBuilder } from './components/PseudoUiBuilder';
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
    if (pseudoUiViewResponse) {
      previewBody = (
        <div className={PREVIEW_SHELL}>
          <PseudoUiViewSurface
            viewResponse={pseudoUiViewResponse}
            mode="preview"
            ariaLabel={`View preview ${viewKeyUi || 'untitled'}`}
            fillHeight={false}
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
            <PseudoUiBuilder
              content={contentValue}
              onContentChange={handleContentChange}
              viewKey={viewKeyUi || 'preview'}
            />
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
