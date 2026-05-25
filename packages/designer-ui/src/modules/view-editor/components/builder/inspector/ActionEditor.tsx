/**
 * Editor for Button.action / Card.onTap fields.
 *
 * SDK vocabulary (`view-vocabulary.md:809-834`) defines exactly
 * three ButtonAction values:
 *
 *   submit | cancel | back
 *
 * Only the literal string `'submit'` triggers SDK-side form
 * validation (`DynamicRenderer.tsx:354-356`). For workflow
 * transitions, the canonical pattern is `action: "submit"` plus a
 * transition URN in `command`:
 *
 *   "command": "urn:amorphie:transition:<domain>:<workflow>:<instance>:<name>"
 *
 * The string-or-descriptor union also accepts a full
 * `ActionDescriptor` `{ action, bind?, value? }` for advanced
 * inline patterns — primarily Card.onTap's
 * `{ action: 'select', bind, value }` shape. R24.2 dropped the
 * legacy preset shortcuts (`select / navigate / reset / transition`)
 * because they were either non-vocabulary or SDK-internal. Authors
 * who need a non-vocabulary descriptor enable "With bind/value" and
 * type the action name in the field directly.
 *
 * For Card.onTap (`multi=true`) we render a small list editor.
 */

import { useMemo } from 'react';
import { MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react';

import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { BUTTON_ACTIONS } from '../types';

export interface ActionEditorProps {
  value: unknown;
  onChange: (next: unknown) => void;
  multi?: boolean;
}

interface ActionDescriptor {
  action: string;
  bind?: string;
  value?: unknown;
}

type ActionLike = string | ActionDescriptor;

function toArray(value: unknown): ActionLike[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as ActionLike[];
  return [value as ActionLike];
}

function isDescriptor(value: ActionLike): value is ActionDescriptor {
  return typeof value === 'object' && value !== null && 'action' in value;
}

export function ActionEditor({ value, onChange, multi }: ActionEditorProps) {
  if (!multi) {
    return <SingleActionEditor value={value} onChange={onChange} />;
  }
  return <MultiActionEditor value={value} onChange={onChange} />;
}

function SingleActionEditor({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const normalized: ActionLike = typeof value === 'string' || isDescriptor(value as ActionLike)
    ? (value as ActionLike)
    : 'submit';
  return <ActionRow value={normalized} onChange={onChange} />;
}

function MultiActionEditor({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const list = useMemo(() => toArray(value), [value]);

  const update = (next: ActionLike[]) => {
    onChange(next.length === 0 ? undefined : next.length === 1 ? next[0] : next);
  };

  return (
    <div className="flex flex-col gap-2">
      {list.length === 0 ? (
        <p className="text-[11px] text-muted-text">No actions configured.</p>
      ) : (
        list.map((item, index) => (
          <div key={index} className="rounded border border-primary-border bg-primary p-2">
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary-text">
                Action {index + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Move action up"
                  disabled={index === 0}
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => {
                    if (index === 0) return;
                    const next = list.slice();
                    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                    update(next);
                  }}
                >
                  <MoveUp size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Move action down"
                  disabled={index === list.length - 1}
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => {
                    if (index === list.length - 1) return;
                    const next = list.slice();
                    [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
                    update(next);
                  }}
                >
                  <MoveDown size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Remove action"
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground"
                  onClick={() => {
                    const next = list.slice();
                    next.splice(index, 1);
                    update(next);
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <ActionRow
              value={item}
              onChange={(nextItem) => {
                const next = list.slice();
                next[index] = nextItem;
                update(next);
              }}
            />
          </div>
        ))
      )}
      <button
        type="button"
        className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={() => update([...list, 'submit'])}
      >
        <Plus size={11} /> Add action
      </button>
    </div>
  );
}

// R24.2 — Hints surfaced under the dropdown. Aligned with SDK
// vocabulary (view-vocabulary.md:813-819).
const VOCABULARY_HINTS: Record<string, string> = {
  submit: 'Runs form validation, then dispatches. Pair with a command URN for workflow transitions.',
  cancel: 'Direct delegate dispatch — no validation.',
  back:   'Direct delegate dispatch — no validation.',
};
const DESCRIPTOR_HINT =
  'Custom descriptor — SDK forwards as-is. Use for `select` bind/value patterns or non-vocabulary actions.';

function ActionRow({ value, onChange }: { value: ActionLike; onChange: (next: ActionLike) => void }) {
  const isPreset = typeof value === 'string';
  const descriptor: ActionDescriptor = isDescriptor(value) ? value : { action: typeof value === 'string' ? value : 'submit' };

  // The "With bind/value" toggle: when ON, the action becomes an
  // object with bind/value; when OFF it's a string literal from the
  // vocabulary preset list.
  const presetValue = isPreset ? value : descriptor.action;
  const isVocabularyValue = BUTTON_ACTIONS.includes(presetValue as (typeof BUTTON_ACTIONS)[number]);
  const allOptions = BUTTON_ACTIONS.map((a) => ({ value: a, label: a }));
  const hintText = !isPreset
    ? DESCRIPTOR_HINT
    : isVocabularyValue
    ? VOCABULARY_HINTS[presetValue as string] ?? ''
    : `Non-vocabulary value "${presetValue}" — SDK forwards as a string; consider switching to a descriptor.`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {isPreset ? (
          <Select
            className="h-8 text-xs"
            value={isVocabularyValue ? presetValue : ''}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Action type"
          >
            {!isVocabularyValue ? (
              <option value="" disabled>
                {`Non-vocabulary: "${presetValue}"`}
              </option>
            ) : null}
            {allOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ) : (
          // Descriptor mode — the action name is free-form (e.g.
          // 'select' for Card.onTap, or any non-vocabulary string).
          // Vocabulary discipline only applies to the string form.
          <Input
            size="sm"
            className="h-8 text-xs"
            value={descriptor.action}
            onChange={(e) => onChange({ ...descriptor, action: e.target.value })}
            placeholder='action (e.g. "select")'
            aria-label="Custom action name"
          />
        )}
        <label className="flex items-center gap-1 text-[10px] text-muted-text">
          <input
            type="checkbox"
            checked={!isPreset}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ action: presetValue });
              } else {
                onChange(presetValue);
              }
            }}
          />
          With bind/value
        </label>
      </div>
      {/* R24.2: tiny inline hint so the user sees the vocabulary +
          validation semantics without leaving the inspector. */}
      {hintText ? (
        <p className="text-[10px] italic text-secondary-text">{hintText}</p>
      ) : null}
      {isPreset && !isVocabularyValue ? (
        <p className="text-[10px] italic text-secondary-text">
          {`Current value: "${presetValue}" is not in the SDK vocabulary. Pick a preset or enable “With bind/value” to convert to a descriptor.`}
        </p>
      ) : null}
      {!isPreset ? (
        <>
          <Input
            size="sm"
            value={descriptor.bind ?? ''}
            onChange={(e) => onChange({ ...descriptor, bind: e.target.value || undefined })}
            placeholder="bind (e.g. branchCode)"
            aria-label="bind"
          />
          <Input
            size="sm"
            value={typeof descriptor.value === 'string' ? descriptor.value : descriptor.value !== undefined ? JSON.stringify(descriptor.value) : ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChange({ ...descriptor, value: undefined });
                return;
              }
              try {
                onChange({ ...descriptor, value: JSON.parse(raw) });
              } catch {
                onChange({ ...descriptor, value: raw });
              }
            }}
            placeholder='value (literal or expression, e.g. "$item.value")'
            aria-label="value"
          />
        </>
      ) : null}
    </div>
  );
}
