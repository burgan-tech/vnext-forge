import { type ReactNode, useMemo, useState } from 'react';

import { cn } from '../../lib/utils/cn.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import {
  isLinkType,
  linkTypeFieldKey,
  normalizeContentForEditor,
  viewTypeToMonacoLanguage,
} from '../view-editor/viewContentHelpers.js';
import { MarkdownPreview, StaticJsonPreview } from '../view-editor/viewPreviews.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { VIEW_TYPE_LABELS } from './readonlyLabels.js';
import { ReadOnlyCodeField } from './shared/ReadOnlyCodeField.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlySectionCard } from './shared/ReadOnlySectionCard.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';
import { asRecord } from './shared/readonlyGuards.js';
import { toDisplayText } from './shared/readonlyText.js';

/**
 * `ViewType.Json` — inlined rather than imported so this module keeps its
 * zero-cross-package-import shape. The numeric ViewType contract itself is
 * reached through the pure `viewContentHelpers`.
 */
const DEFAULT_VIEW_TYPE = 1;

/** Matches `ViewEditorPanel`'s `displayStrategyValue` fallback. */
const DEFAULT_DISPLAY = 'full-page';

/**
 * `ViewRenderer.PseudoUi` — inlined for the same reason as `DEFAULT_VIEW_TYPE`.
 */
const PSEUDO_UI_RENDERER = 'pseudo-ui';

type ContentTab = 'preview' | 'raw';

const CONTENT_TABS: { id: ContentTab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'raw', label: 'Raw' },
];

/**
 * Reads the `href` / `urn` target of a link-type view.
 *
 * The editor's `HrefUrnField.parseFieldValue` reads it out of the *stringified*
 * content, while the canonical on-disk document holds a plain object — and the
 * monitor API may hand over either. All three shapes are accepted here: an
 * object, its JSON text, and a bare target string (which the editor would
 * discard, but a read-only surface should still show).
 */
function readLinkTarget(content: unknown, key: 'href' | 'urn'): string {
  let record = asRecord(content);
  if (!record && typeof content === 'string') {
    try {
      record = asRecord(JSON.parse(content));
    } catch {
      return content;
    }
  }
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Reads the view content as a plain object, accepting both the canonical object
 * shape and its JSON text (the monitor API may hand over either). Returns
 * `null` when the content is not a JSON object — the pseudo-ui surface needs a
 * real object, so the preview falls back to a message in that case.
 */
function readContentObject(content: unknown): Record<string, unknown> | null {
  const record = asRecord(content);
  if (record) return record;
  if (typeof content === 'string' && content.trim() !== '') {
    try {
      return asRecord(JSON.parse(content)) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Muted placeholder shown when a preview cannot be produced. */
function PreviewMessage({ text }: { text: string }) {
  return (
    <div className="border-border flex min-h-64 items-center justify-center rounded-lg border p-3">
      <p className="text-muted-foreground text-xs" role="status">
        {text}
      </p>
    </div>
  );
}

export interface ViewDetailCoreProps {
  json: Record<string, unknown>;
  /**
   * Host-supplied pseudo-ui renderer (monitoring wires `PseudoUiViewSurface`
   * here); the core itself must not import quick-run. Receives the parsed
   * content object.
   */
  renderPseudoUiPreview?: (content: Record<string, unknown>) => ReactNode;
}

/**
 * Read-only designer view of a view component document.
 *
 * `attributes.content` is a plain object (JSON views) or a plain string
 * (HTML / Markdown) — never base64 — so it goes straight into Monaco through
 * the pure `normalizeContentForEditor`. Link types (Deep Link / HTTP / URN)
 * carry a single `href` / `urn` key instead and render as one value field.
 * `normalizeDefinitionDoc('view', …)` lifts a flattened monitor-API
 * `type` / `display` / `renderer` / `content` / `labels` back into `attributes`.
 *
 * `attributes.type` arrives as either a number or a numeric string depending on
 * the producer, so it is coerced once: the display label is looked up by the
 * stringified form (as `VIEW_TYPE_LABELS` documents) and the pure helpers get
 * the numeric form they expect.
 *
 * The Content card carries a Preview / Raw toggle. Preview mirrors the editable
 * `ViewEditorPanel` matrix (pseudo-ui surface, HTML, Markdown, JSON), Raw is the
 * Monaco field and stays reachable for every type — including the link types,
 * whose Preview branch is the single Target field.
 */
export function ViewDetailCore({ json: raw, renderPseudoUiPreview }: ViewDetailCoreProps) {
  const [contentTab, setContentTab] = useState<ContentTab>('preview');
  const json = useMemo(() => normalizeDefinitionDoc('view', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;

  const rawType = attrs.type;
  const typeKey =
    rawType === null || rawType === undefined || rawType === '' ? '' : toDisplayText(rawType);
  const parsedType = Number(typeKey);
  // An unrecognized type still renders — the numeric helpers fall back to the
  // JSON behaviour (json language, free-form editor) and the label keeps the
  // raw value visible instead of silently claiming "JSON".
  const viewType = typeKey !== '' && Number.isInteger(parsedType) ? parsedType : DEFAULT_VIEW_TYPE;
  const typeLabel =
    typeKey === ''
      ? VIEW_TYPE_LABELS[String(DEFAULT_VIEW_TYPE)]
      : (VIEW_TYPE_LABELS[typeKey] ?? `Type ${typeKey}`);

  const display =
    typeof attrs.display === 'string' && attrs.display ? attrs.display : DEFAULT_DISPLAY;
  const renderer = typeof attrs.renderer === 'string' ? attrs.renderer : '';
  const content = attrs.content;

  const isLink = isLinkType(viewType);
  const linkTarget = isLink ? readLinkTarget(content, linkTypeFieldKey(viewType)) : '';

  // The Monaco language doubles as the preview discriminator: `viewTypeToMonaco
  // Language` already collapses the numeric ViewType contract into
  // html / markdown / json, so no numeric ViewType constants are inlined here.
  const language = viewTypeToMonacoLanguage(viewType);
  const contentText = useMemo(
    () => normalizeContentForEditor(content, viewType),
    [content, viewType],
  );
  const contentObject = useMemo(() => readContentObject(content), [content]);

  let previewBody: ReactNode;
  if (isLink) {
    previewBody = <ReadOnlyValueField label="Target" value={linkTarget} mono />;
  } else if (language === 'html') {
    // Unlike the editor (which renders trusted local workspace HTML inline),
    // this surface shows HTML that came from the runtime — so it is confined to
    // a fully sandboxed frame: no scripts, no forms, no same-origin access.
    previewBody = (
      <iframe
        sandbox=""
        srcDoc={contentText}
        title="HTML preview"
        className="border-border h-64 w-full rounded border bg-white"
      />
    );
  } else if (language === 'markdown') {
    previewBody = <MarkdownPreview text={contentText} />;
  } else if (renderer === PSEUDO_UI_RENDERER) {
    if (!renderPseudoUiPreview) {
      previewBody = <PreviewMessage text="Pseudo-ui preview is not available." />;
    } else if (!contentObject) {
      previewBody = (
        <PreviewMessage text="This view does not carry a valid pseudo-ui JSON object." />
      );
    } else {
      previewBody = (
        <div className="border-border min-h-64 rounded-lg border">
          {renderPseudoUiPreview(contentObject)}
        </div>
      );
    }
  } else {
    previewBody = <StaticJsonPreview text={contentText} />;
  }

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection
          json={json}
          title="View Metadata"
          description="Identity, flow bindings and presentation of this view.">
          <ReadOnlyValueField label="Type" value={typeLabel} />
          <ReadOnlyValueField label="Display Strategy" value={display} />
          {renderer && <ReadOnlyValueField label="Renderer" value={renderer} />}
        </ReadOnlyMetadataSection>

        <ReadOnlySectionCard
          title="Content"
          description={`The ${typeLabel} payload this view carries.`}>
          <div className="flex flex-col gap-3">
            <div
              className="border-border flex gap-0 border-b"
              role="tablist"
              aria-label="Content display mode">
              {CONTENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={contentTab === tab.id}
                  onClick={() => setContentTab(tab.id)}
                  className={cn(
                    'border-b-2 px-3 py-1.5 text-xs font-medium transition-colors',
                    contentTab === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}>
                  {tab.label}
                </button>
              ))}
            </div>

            {contentTab === 'preview' ? (
              previewBody
            ) : (
              <ReadOnlyCodeField
                value={contentText}
                language={language}
                height={320}
                title="Content"
              />
            )}
          </div>
        </ReadOnlySectionCard>
      </div>
    </FormReadOnlyProvider>
  );
}
