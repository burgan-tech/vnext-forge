import { useEffect, useState } from 'react';

import { Field } from '../../../../../ui/Field';
import { Input } from '../../../../../ui/Input';
import { JsonCodeField } from '../../../../../ui/JsonCodeField';
import { Select } from '../../../../../ui/Select';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

export type ContextSourceShape = 'const' | 'context' | 'identity';
export type ContextBoundary = 'device' | 'user' | 'subject';
export type ContextStorage = 'memory' | 'local' | 'secure';
export type ContextIdentityRef = 'subject' | 'user';

const BOUNDARIES: readonly ContextBoundary[] = ['device', 'user', 'subject'];
const STORAGES: readonly ContextStorage[] = ['memory', 'local', 'secure'];
const IDENTITIES: readonly ContextIdentityRef[] = ['subject', 'user'];

export interface ContextSourceModel {
  shape: ContextSourceShape;
  const: unknown;
  boundary: ContextBoundary;
  key: string;
  storage: ContextStorage | '';
  identity: ContextIdentityRef;
}

interface XContextSourceCardProps {
  pointer: JsonPointer;
}

function defaultModel(): ContextSourceModel {
  return {
    shape: 'context',
    const: null,
    boundary: 'user',
    key: '',
    storage: '',
    identity: 'subject',
  };
}

const DEFAULT_VALUE = (): Record<string, unknown> => ({ context: { boundary: 'user', key: '' } });

/**
 * Turns a stored `x-context-source` value into an editor model with a
 * `shape` discriminator. Unrecognized/partial input falls back to the
 * `context` shape with sensible defaults so the card always has something
 * to render.
 */
export function normalizeContextSource(raw: unknown): ContextSourceModel {
  const base = defaultModel();

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return base;
  }

  const record = raw as Record<string, unknown>;

  if ('const' in record) {
    return { ...base, shape: 'const', const: record.const };
  }

  if (record.identity !== undefined) {
    return {
      ...base,
      shape: 'identity',
      identity: record.identity === 'user' ? 'user' : 'subject',
    };
  }

  const context = record.context;

  if (context && typeof context === 'object' && !Array.isArray(context)) {
    const ctx = context as Record<string, unknown>;
    const boundary =
      typeof ctx.boundary === 'string' && (BOUNDARIES as readonly string[]).includes(ctx.boundary)
        ? (ctx.boundary as ContextBoundary)
        : 'user';
    const storage =
      typeof ctx.storage === 'string' && (STORAGES as readonly string[]).includes(ctx.storage)
        ? (ctx.storage as ContextStorage)
        : '';

    return {
      ...base,
      shape: 'context',
      boundary,
      key: typeof ctx.key === 'string' ? ctx.key : '',
      storage,
    };
  }

  return base;
}

/**
 * Turns the editor model back into exactly one of the three vocab shapes,
 * omitting empty subkeys (e.g. an unset `storage`).
 */
export function serializeContextSource(model: ContextSourceModel): Record<string, unknown> {
  if (model.shape === 'const') {
    return { const: model.const };
  }

  if (model.shape === 'identity') {
    return { identity: model.identity };
  }

  const context: Record<string, unknown> = {
    boundary: model.boundary,
    key: model.key,
  };

  if (model.storage) {
    context.storage = model.storage;
  }

  return { context };
}

/**
 * `x-context-source` marks a schema property as client-resolved. Exactly one
 * of three shapes is persisted:
 * `{ const }` | `{ context: { boundary, key, storage? } }` | `{ identity }`.
 */
export function XContextSourceCard({ pointer }: XContextSourceCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-context-source', DEFAULT_VALUE);
  const current = normalizeContextSource(node?.['x-context-source']);

  function update(patch: Partial<ContextSourceModel>) {
    const next = { ...current, ...patch };
    updateComponent(setKeyword(pointer, 'x-context-source', serializeContextSource(next)));
  }

  return (
    <VNextCardShell
      xKey="x-context-source"
      title="Context Source"
      purpose="Mark this field as client-resolved: a literal constant, a context-store slot, or an identity reference."
      enabled={enabled}
      onToggle={toggle}>
      <Field label="Shape">
        <Select
          className="h-8 text-xs"
          value={current.shape}
          onChange={(event) => update({ shape: event.target.value as ContextSourceShape })}>
          <option value="const">const (literal value)</option>
          <option value="context">context (client-resolved slot)</option>
          <option value="identity">identity (subject/user reference)</option>
        </Select>
      </Field>

      {current.shape === 'const' ? (
        <ConstField value={current.const} onChange={(next) => update({ const: next })} />
      ) : null}

      {current.shape === 'context' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Boundary">
            <Select
              className="h-8 text-xs"
              value={current.boundary}
              onChange={(event) => update({ boundary: event.target.value as ContextBoundary })}>
              {BOUNDARIES.map((boundary) => (
                <option key={boundary} value={boundary}>
                  {boundary}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Storage">
            <Select
              className="h-8 text-xs"
              value={current.storage}
              onChange={(event) =>
                update({ storage: event.target.value as ContextStorage | '' })
              }>
              <option value="">(default)</option>
              {STORAGES.map((storage) => (
                <option key={storage} value={storage}>
                  {storage}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="sm:col-span-2" label="Key" hint="Template string identifying the context slot.">
            <Input
              type="text"
              value={current.key}
              onChange={(event) => update({ key: event.target.value })}
              placeholder="profile:{subject}"
              inputClassName="font-mono text-xs"
            />
          </Field>
        </div>
      ) : null}

      {current.shape === 'identity' ? (
        <Field label="Identity">
          <Select
            className="h-8 text-xs"
            value={current.identity}
            onChange={(event) => update({ identity: event.target.value as ContextIdentityRef })}>
            {IDENTITIES.map((identity) => (
              <option key={identity} value={identity}>
                {identity}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </VNextCardShell>
  );
}

function ConstField({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const initial = JSON.stringify(value ?? null, null, 2);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(JSON.stringify(value ?? null, null, 2));
    setError(null);
  }, [value]);

  return (
    <Field
      label="Const value"
      hint="Any JSON literal (string, number, boolean, null, object, array)."
      errorMsg={error}>
      <JsonCodeField
        value={draft}
        height={100}
        onChange={(next) => {
          setDraft(next);

          try {
            const parsed: unknown = next.trim() === '' ? null : JSON.parse(next);
            setError(null);
            onChange(parsed);
          } catch {
            setError('Value must be valid JSON.');
          }
        }}
      />
    </Field>
  );
}
