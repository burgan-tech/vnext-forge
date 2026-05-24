/**
 * Editor for Button.action / Card.onTap fields.
 *
 * pseudo-ui's action value can be:
 *   - a string literal: 'submit' | 'cancel' | 'back'
 *   - an ActionDescriptor: { action, bind?, value? }
 *   - (for Card.onTap) an array of ActionDescriptor
 *
 * For single mode, we let the user pick a preset OR define a custom
 * descriptor. For multi mode (`multi=true`), we render a small list editor.
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
        <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">No actions configured.</p>
      ) : (
        list.map((item, index) => (
          <div key={index} className="rounded border border-primary-border bg-primary p-2">
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                Action {index + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Move action up"
                  disabled={index === 0}
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
                  className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)]"
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

function ActionRow({ value, onChange }: { value: ActionLike; onChange: (next: ActionLike) => void }) {
  const isPreset = typeof value === 'string';
  const descriptor: ActionDescriptor = isDescriptor(value) ? value : { action: typeof value === 'string' ? value : 'submit' };

  // The "Use descriptor" toggle: when ON, the action becomes an object with
  // bind/value; when OFF it's a string literal.
  const presetValue = isPreset ? (value) : descriptor.action;
  const customPresets = ['select', 'navigate', 'reset'];
  const allOptions = [
    ...BUTTON_ACTIONS.map((a) => ({ value: a, label: a })),
    ...customPresets.map((a) => ({ value: a, label: a })),
  ];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Select
          className="h-8 text-xs"
          value={presetValue}
          onChange={(e) => {
            const next = e.target.value;
            if (isPreset) {
              if (BUTTON_ACTIONS.includes(next as (typeof BUTTON_ACTIONS)[number])) {
                onChange(next);
              } else {
                onChange({ action: next });
              }
            } else {
              onChange({ ...descriptor, action: next });
            }
          }}
          aria-label="Action type"
        >
          {allOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
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
