/**
 * RichText `spans[]` editor (R16.2-C).
 *
 * Vocabulary (`view-vocabulary.json` → richTextComponent → `spans[]`):
 *
 *   {
 *     text:    textContent  // required, multi-lang
 *     variant: typographyVariant  // optional
 *     bold:    boolean      // optional
 *     italic:  boolean      // optional
 *     link:    string       // optional URL
 *   }
 *
 * Mirrors `StepsField` shape — bordered cards per span with reorder /
 * remove + an Add button. Text uses `MultiLangInput` so designers can
 * author per-locale copy inline; style modifiers are inline checkboxes
 * and a single Select for the typography variant.
 */
import { MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react';

import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { MultiLangInput } from './MultiLangInput';

export interface SpanValue {
  text?: unknown;
  variant?: string;
  bold?: boolean;
  italic?: boolean;
  link?: string;
  [extra: string]: unknown;
}

export interface SpansFieldProps {
  value: unknown;
  onChange: (next: unknown) => void;
}

/** Typography variants from `view-vocabulary.json#/$defs/typographyVariant`. */
const TYPOGRAPHY_VARIANTS: readonly string[] = [
  'displayLarge', 'displayMedium', 'displaySmall',
  'headlineLarge', 'headlineMedium', 'headlineSmall',
  'titleLarge', 'titleMedium', 'titleSmall',
  'bodyLarge', 'bodyMedium', 'bodySmall',
  'labelLarge', 'labelMedium', 'labelSmall',
];

function asSpanArray(value: unknown): SpanValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is SpanValue => typeof s === 'object' && s !== null);
}

export function SpansField({ value, onChange }: SpansFieldProps) {
  const spans = asSpanArray(value);

  const update = (next: SpanValue[]): void => {
    onChange(next.length === 0 ? undefined : next);
  };

  const replaceAt = (index: number, patch: Partial<SpanValue>): void => {
    const next = spans.slice();
    next[index] = { ...next[index], ...patch };
    update(next);
  };

  const removeAt = (index: number): void => {
    const next = spans.slice();
    next.splice(index, 1);
    update(next);
  };

  const moveUp = (index: number): void => {
    if (index <= 0) return;
    const next = spans.slice();
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    update(next);
  };

  const moveDown = (index: number): void => {
    if (index >= spans.length - 1) return;
    const next = spans.slice();
    [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
    update(next);
  };

  const addSpan = (): void => {
    update([...spans, { text: { en: '' } }]);
  };

  return (
    <div className="flex flex-col gap-2">
      {spans.length === 0 ? (
        <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">No spans defined.</p>
      ) : (
        spans.map((span, i) => (
          <div key={i} className="rounded border border-primary-border bg-primary p-2">
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Span {i + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => moveUp(i)}
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <MoveUp size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === spans.length - 1}
                  onClick={() => moveDown(i)}
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <MoveDown size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Remove span"
                  onClick={() => removeAt(i)}
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-errorForeground)]"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <MultiLangInput
                value={span.text}
                onChange={(next) => replaceAt(i, { text: next as SpanValue['text'] })}
                placeholder="Text"
              />
              <div className="flex items-center gap-1">
                <Select
                  className="h-8 flex-1 text-xs"
                  value={span.variant ?? ''}
                  onChange={(e) => replaceAt(i, { variant: e.target.value || undefined })}
                  aria-label="Typography variant"
                >
                  <option value="">— variant —</option>
                  {TYPOGRAPHY_VARIANTS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
                <label className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
                  <input
                    type="checkbox"
                    checked={Boolean(span.bold)}
                    onChange={(e) => replaceAt(i, { bold: e.target.checked || undefined })}
                  />
                  B
                </label>
                <label className="flex items-center gap-1 text-[10px] italic text-[var(--vscode-descriptionForeground)]">
                  <input
                    type="checkbox"
                    checked={Boolean(span.italic)}
                    onChange={(e) => replaceAt(i, { italic: e.target.checked || undefined })}
                  />
                  I
                </label>
              </div>
              <Input
                size="sm"
                value={span.link ?? ''}
                onChange={(e) => replaceAt(i, { link: e.target.value || undefined })}
                placeholder="link (https://…)"
                aria-label="Link URL"
              />
            </div>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={addSpan}
        className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
      >
        <Plus size={11} /> Add span
      </button>
    </div>
  );
}
