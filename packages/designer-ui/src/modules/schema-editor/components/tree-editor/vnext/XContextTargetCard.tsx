import { Plus, Trash2 } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

export type ContextBoundary = 'device' | 'user' | 'subject';
export type ContextStorage = 'memory' | 'local' | 'secure';

const BOUNDARIES: readonly ContextBoundary[] = ['device', 'user', 'subject'];
const STORAGES: readonly ContextStorage[] = ['memory', 'local', 'secure'];

export interface ContextTargetRow {
  path: string;
  boundary: ContextBoundary;
  key: string;
  storage?: ContextStorage;
}

interface XContextTargetCardProps {
  pointer: JsonPointer;
}

function emptyRow(): ContextTargetRow {
  return { path: '', boundary: 'user', key: '' };
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
      typeof ctx.boundary === 'string' && (BOUNDARIES as readonly string[]).includes(ctx.boundary)
        ? (ctx.boundary as ContextBoundary)
        : 'user';
    const storage =
      typeof ctx.storage === 'string' && (STORAGES as readonly string[]).includes(ctx.storage)
        ? (ctx.storage as ContextStorage)
        : undefined;

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
 */
export function XContextTargetCard({ pointer }: XContextTargetCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-context-target', DEFAULT_VALUE);
  const rows = normalizeContextTarget(node?.['x-context-target']);
  const displayRows = rows.length > 0 ? rows : [emptyRow()];

  function commit(next: ContextTargetRow[]) {
    updateComponent(setKeyword(pointer, 'x-context-target', serializeContextTarget(next)));
  }

  function updateRow(index: number, patch: Partial<ContextTargetRow>) {
    commit(displayRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    commit(displayRows.filter((_, i) => i !== index));
  }

  function addRow() {
    commit([...displayRows, emptyRow()]);
  }

  return (
    <VNextCardShell
      xKey="x-context-target"
      title="Context Targets"
      purpose="Map instance-data field paths to client-context slots that populate them on load."
      enabled={enabled}
      onToggle={toggle}>
      <div className="space-y-2">
        {displayRows.map((row, index) => (
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-7 shrink-0 p-0 text-destructive-text"
                aria-label={`Remove context target ${index + 1}`}
                onClick={() => removeRow(index)}>
                <Trash2 size={12} />
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Boundary">
                <Select
                  className="h-8 text-xs"
                  value={row.boundary}
                  onChange={(event) => updateRow(index, { boundary: event.target.value as ContextBoundary })}>
                  {BOUNDARIES.map((boundary) => (
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
                  {STORAGES.map((storage) => (
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

      <Button
        type="button"
        variant="success"
        size="sm"
        className="h-7 gap-1 text-[10px]"
        onClick={addRow}>
        <Plus size={10} />
        Add context target
      </Button>
    </VNextCardShell>
  );
}
