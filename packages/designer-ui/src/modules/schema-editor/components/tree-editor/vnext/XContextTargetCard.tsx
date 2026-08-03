import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../../../../ui/Button';
import { Field } from '../../../../../ui/Field';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import {
  CONTEXT_BOUNDARIES,
  CONTEXT_STORAGES,
  isContextBoundary,
  isContextStorage,
  type ContextBoundary,
  type ContextStorage,
} from './contextVocab';
import { VNextCardShell } from './VNextCardShell';

export interface ContextTargetRow {
  path: string;
  boundary: ContextBoundary;
  key: string;
  storage?: ContextStorage;
}

interface XContextTargetCardProps {
  pointer: JsonPointer;
}

export function emptyContextTargetRow(): ContextTargetRow {
  return { path: '', boundary: 'user', key: '' };
}

/** Seeds the displayed row list: existing rows, or one blank row so the
 * minProperties≥1 UX always has something to fill in. */
export function seedContextTargetRows(rows: ContextTargetRow[]): ContextTargetRow[] {
  return rows.length > 0 ? rows : [emptyContextTargetRow()];
}

export type ContextTargetRowAction =
  | { type: 'add' }
  | { type: 'update'; index: number; patch: Partial<ContextTargetRow> }
  | { type: 'remove'; index: number };

/**
 * Pure reducer over the row list displayed in the editor. Kept separate
 * from the component so add/update/remove transitions are unit-testable
 * without mounting anything — this is the piece that must never collapse a
 * blank-path row that the user is still filling in.
 */
export function applyTargetRowChange(
  rows: ContextTargetRow[],
  action: ContextTargetRowAction,
): ContextTargetRow[] {
  switch (action.type) {
    case 'add':
      return [...rows, emptyContextTargetRow()];
    case 'update':
      return rows.map((row, i) => (i === action.index ? { ...row, ...action.patch } : row));
    case 'remove':
      return rows.filter((_, i) => i !== action.index);
    default:
      return rows;
  }
}

// Vocab `minProperties: 1` — seed with one empty-path row (mirrors the
// x-roles seed pattern of keeping a single blank entry) so the keyword
// starts populated and the user has an immediate row to fill in.
const DEFAULT_VALUE = (): Record<string, unknown> => ({ '': { context: { boundary: 'user', key: '' } } });

/**
 * Turns a stored `x-context-target` path→slot map into a row array for the
 * editor. Entries that are not shaped like `{ context: { boundary, key } }`
 * are dropped rather than raising — the raw fallback keeps unknown shapes
 * lossless elsewhere.
 */
export function normalizeContextTarget(raw: unknown): ContextTargetRow[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return [];
  }

  const rows: ContextTargetRow[] = [];

  for (const [path, slot] of Object.entries(raw as Record<string, unknown>)) {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
      continue;
    }

    const context = (slot as Record<string, unknown>).context;

    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      continue;
    }

    const ctx = context as Record<string, unknown>;
    const boundary =
      typeof ctx.boundary === 'string' && isContextBoundary(ctx.boundary) ? ctx.boundary : 'user';
    const storage =
      typeof ctx.storage === 'string' && isContextStorage(ctx.storage) ? ctx.storage : undefined;

    rows.push({
      path,
      boundary,
      key: typeof ctx.key === 'string' ? ctx.key : '',
      ...(storage ? { storage } : {}),
    });
  }

  return rows;
}

/**
 * Turns the row array back into a path→slot map, dropping rows whose path
 * is empty (or whitespace-only) so a blank editor row never persists.
 */
export function serializeContextTarget(rows: ContextTargetRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const row of rows) {
    const path = row.path.trim();

    if (path.length === 0) {
      continue;
    }

    const context: Record<string, unknown> = {
      boundary: row.boundary,
      key: row.key,
    };

    if (row.storage) {
      context.storage = row.storage;
    }

    out[path] = { context };
  }

  return out;
}

/**
 * `x-context-target` (root-only) maps instance-data field paths (dot
 * notation) to client-context slots that should populate them. Persisted
 * shape: `{ [path]: { context: { boundary, key, storage? } } }`.
 *
 * The store value is the *filtered* serialization (blank-path rows
 * dropped), so it cannot be the render source of truth — re-deriving the
 * displayed rows from it on every render would revert any edit made before
 * a path is typed, and would filter out a freshly-added blank row before
 * the user could type into it. Instead, the rows shown in the UI are held
 * in local state; the store is written to (via `serializeContextTarget`)
 * as a side effect of each edit, but local state remains authoritative for
 * what's on screen. Local state is only resynced from the store when the
 * store changes for a reason other than our own last commit — i.e. the
 * keyword was just toggled on (fresh seed), or the document/selection was
 * swapped out from under the card (undo/redo, loading a different file).
 */
export function XContextTargetCard({ pointer }: XContextTargetCardProps) {
  const readOnly = useFormReadOnly();
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-context-target', DEFAULT_VALUE);

  const storedValue = node?.['x-context-target'];
  const lastWrittenJsonRef = useRef<string | null>(null);

  const [rows, setRows] = useState<ContextTargetRow[]>(() =>
    seedContextTargetRows(normalizeContextTarget(storedValue)),
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const storedJson = JSON.stringify(storedValue ?? null);

    if (storedJson === lastWrittenJsonRef.current) {
      // The store changed because of our own commit() below — local `rows`
      // is already the source of truth (it may hold an in-flight
      // blank-path row that the store intentionally omits).
      return;
    }

    // External change: keyword just toggled on, undo/redo, or a different
    // document/selection landed on this pointer — resync from the store.
    setRows(seedContextTargetRows(normalizeContextTarget(storedValue)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, storedValue]);

  function commit(next: ContextTargetRow[]) {
    setRows(next);
    const serialized = serializeContextTarget(next);
    lastWrittenJsonRef.current = JSON.stringify(serialized);
    updateComponent(setKeyword(pointer, 'x-context-target', serialized));
  }

  function updateRow(index: number, patch: Partial<ContextTargetRow>) {
    commit(applyTargetRowChange(rows, { type: 'update', index, patch }));
  }

  function removeRow(index: number) {
    commit(applyTargetRowChange(rows, { type: 'remove', index }));
  }

  function addRow() {
    commit(applyTargetRowChange(rows, { type: 'add' }));
  }

  return (
    <VNextCardShell
      xKey="x-context-target"
      title="Context Targets"
      purpose="Map instance-data field paths to client-context slots that populate them on load."
      enabled={enabled}
      onToggle={toggle}>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="space-y-2 rounded-md border border-primary-border bg-primary-muted/40 px-3 py-2">
            <div className="flex items-end gap-2">
              <Field className="flex-1" label="Field path" hint="Dot-notation path into instance data.">
                <Input
                  type="text"
                  value={row.path}
                  onChange={(event) => updateRow(index, { path: event.target.value })}
                  placeholder="profile.name"
                  inputClassName="font-mono text-xs"
                />
              </Field>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 shrink-0 p-0 text-destructive-text"
                  aria-label={`Remove context target ${index + 1}`}
                  onClick={() => removeRow(index)}>
                  <Trash2 size={12} />
                </Button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Boundary">
                <Select
                  className="h-8 text-xs"
                  value={row.boundary}
                  onChange={(event) => updateRow(index, { boundary: event.target.value as ContextBoundary })}>
                  {CONTEXT_BOUNDARIES.map((boundary) => (
                    <option key={boundary} value={boundary}>
                      {boundary}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Key" hint="Template string.">
                <Input
                  type="text"
                  value={row.key}
                  onChange={(event) => updateRow(index, { key: event.target.value })}
                  placeholder="name:{instance}"
                  inputClassName="font-mono text-xs"
                />
              </Field>
              <Field label="Storage">
                <Select
                  className="h-8 text-xs"
                  value={row.storage ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateRow(index, { storage: value === '' ? undefined : (value as ContextStorage) });
                  }}>
                  <option value="">(default)</option>
                  {CONTEXT_STORAGES.map((storage) => (
                    <option key={storage} value={storage}>
                      {storage}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={addRow}>
          <Plus size={10} />
          Add context target
        </Button>
      )}
    </VNextCardShell>
  );
}
