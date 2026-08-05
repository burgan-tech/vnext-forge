import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { JsonEditorWithCopy } from '../../quick-run/components/CopyableJsonBlock';
import { SchemaForm, type JsonSchemaRoot } from '../../schema-form';
import { CONTENT_TYPES, toQueryValue, type ContentTypeId } from '../functionRunPayload';

export interface FunctionRunPayloadEditorProps {
  contentType: ContentTypeId;
  onContentTypeChange: (next: ContentTypeId) => void;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** From `inputSchema`, when the contract declares one. */
  schema: Record<string, unknown> | null;
  verb: FunctionVerb;
}

const NO_BODY_VERBS: readonly FunctionVerb[] = ['GET', 'DELETE'];

/**
 * Content-type selector plus the JSON/form editor for the free payload.
 *
 * Available in every mode and for every verb — GET/DELETE never disable it,
 * they just relabel where the values end up (query parameters instead of a
 * body), because free input must never be taken away.
 */
export function FunctionRunPayloadEditor({
  contentType,
  onContentTypeChange,
  value,
  onChange,
  schema,
  verb,
}: FunctionRunPayloadEditorProps) {
  const sendsNoBody = NO_BODY_VERBS.includes(verb);

  return (
    <div className="flex flex-col gap-2">
      <Field label="Content type">
        <Select
          value={contentType}
          onChange={(e) => onContentTypeChange(e.target.value as ContentTypeId)}
          className="text-xs">
          <option value="json">{CONTENT_TYPES.json}</option>
          <option value="form">{CONTENT_TYPES.form}</option>
        </Select>
      </Field>

      {sendsNoBody ? (
        <p className="text-muted-foreground text-[10px]">
          GET and DELETE send no body — these values are sent as query parameters.
        </p>
      ) : null}

      {contentType === 'form' ? (
        <FormRows value={value} onChange={onChange} />
      ) : schema ? (
        <SchemaForm
          schema={schema as JsonSchemaRoot}
          objectValue={value}
          onObjectChange={onChange}
          showRawToggle
          jsonEditorRows={10}
        />
      ) : (
        <JsonPayloadField value={value} onChange={onChange} />
      )}
    </div>
  );
}

/**
 * Whether a controlled editor holding a canonical serialization of its
 * parent's `value` must resync its local, editable copy.
 *
 * `lastPushed` is what this field itself last reported upstream via its
 * `onChange` — deliberately *not* a "did we just push" boolean flag. A flag
 * strands permanently the first time a push is semantically a no-op
 * (reformatting the same object, or a parent that normalises to a
 * content-equal value): nothing ever clears it again except the dependency
 * firing, and a content-identical re-render never fires it, so the very
 * next *genuine* external reset (switching function, say) finds the stale
 * flag still set and is wrongly swallowed — the editor then silently
 * diverges from the parent from that point on. Comparing serialized
 * strings has nothing to strand: every call is judged independently, and
 * "reset to a content-equal value" is correctly just `false`, not a special
 * case that needs remembering.
 */
export function shouldResyncFromValue(serializedValue: string, lastPushed: string | null): boolean {
  return serializedValue !== lastPushed;
}

/**
 * Free JSON editor for when the contract declares no input schema.
 *
 * The editor's own `text` is the source of truth for what is on screen —
 * the parent's `value` cannot represent "half-typed JSON", so a naive
 * controlled loop fed straight from `value` would have nothing to show
 * while the user's in-progress text fails to parse. Only a *valid* parsed
 * object is ever reported upstream; see `shouldResyncFromValue` for how an
 * echo of our own push is told apart from a genuine external reset.
 */
function JsonPayloadField({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const serialized = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [text, setText] = useState(serialized);
  const [parseError, setParseError] = useState<string | null>(null);
  const lastPushedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldResyncFromValue(serialized, lastPushedRef.current)) return;
    setText(serialized);
    setParseError(null);
  }, [serialized]);

  function handleChange(next: string) {
    setText(next);
    try {
      const parsed: unknown = JSON.parse(next);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParseError('Payload must be a JSON object.');
        return;
      }
      setParseError(null);
      // Canonicalised the same way `serialized` is computed above, so a
      // later comparison recognises this exact push regardless of how the
      // user originally formatted their input (compact vs. pretty).
      lastPushedRef.current = JSON.stringify(parsed, null, 2);
      onChange(parsed as Record<string, unknown>);
    } catch (error) {
      // The parse error is visible below; the parent is never told about
      // invalid JSON, so the last good object is what would actually be sent.
      setParseError(error instanceof Error ? error.message : 'Invalid JSON.');
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <JsonEditorWithCopy value={text} onChange={handleChange} rows={10} label="Payload (JSON)" />
      {parseError ? <p className="text-destructive-text text-[10px]">{parseError}</p> : null}
    </div>
  );
}

interface FormRow {
  id: string;
  key: string;
  value: string;
}

let formRowIdSeq = 0;
function nextFormRowId(): string {
  formRowIdSeq += 1;
  return `function-run-form-row-${formRowIdSeq}`;
}

/**
 * Renders one incoming value for a form row. Delegates to
 * `toQueryValue` (the same helper `buildInvokeRequest` uses to encode the
 * query/form-urlencoded wire shape) so a nested object survives as JSON
 * instead of collapsing to `"[object Object]"` on the first unrelated edit.
 */
function toRowValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  return toQueryValue(v as string | number | boolean | object);
}

function formRowsToRecord(rows: readonly FormRow[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const row of rows) {
    if (row.key.trim() === '') continue;
    record[row.key] = row.value;
  }
  return record;
}

/**
 * Rebuilds the row list for a genuinely new `value` from outside (switching
 * function, an external reset). Matches incoming entries to existing rows
 * by key so an untouched row keeps its id — and therefore its mounted
 * `<Input>` — instead of remounting and dropping focus/caret on every
 * resync. Exported for direct unit testing: id-stability under a real
 * external change is exactly the property that regenerating ids on every
 * call broke.
 */
export function reconcileFormRows(prevRows: readonly FormRow[], value: Record<string, unknown>): FormRow[] {
  const byKey = new Map<string, FormRow>();
  for (const row of prevRows) {
    if (row.key !== '' && !byKey.has(row.key)) byKey.set(row.key, row);
  }
  return Object.entries(value).map(([key, v]) => {
    const existing = byKey.get(key);
    return { id: existing?.id ?? nextFormRowId(), key, value: toRowValue(v) };
  });
}

function toFormRows(value: Record<string, unknown>): FormRow[] {
  return reconcileFormRows([], value);
}

/**
 * Key/value rows for `application/x-www-form-urlencoded`. Nested values
 * cannot survive this encoding, so a hint says so instead of silently
 * flattening a nested object into `"[object Object]"`.
 *
 * Resync follows the same `shouldResyncFromValue` rule as `JsonPayloadField`
 * — an echo of a row edit this component itself just committed must not
 * rebuild the row list (which would drop an in-progress blank row, or any
 * row not yet reflected in `value` because its key is still being typed),
 * while a genuine external reset must still replace it via
 * `reconcileFormRows`.
 */
function FormRows({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [rows, setRows] = useState<FormRow[]>(() => toFormRows(value));
  const serializedValue = useMemo(() => JSON.stringify(value), [value]);
  const lastPushedRef = useRef<string | null>(null);
  // `value` itself is deliberately not a dependency: `serializedValue` is a
  // string, so two content-equal-but-different-reference `value`s produce
  // the *same* dependency-array entry (strings compare by value) and the
  // effect correctly does not re-run — only a genuine content change does.
  // The effect still reads the current `value` via closure when it does run.
  useEffect(() => {
    if (!shouldResyncFromValue(serializedValue, lastPushedRef.current)) return;
    setRows((prevRows) => reconcileFormRows(prevRows, value));
  }, [serializedValue]);

  function commit(next: FormRow[]) {
    setRows(next);
    const record = formRowsToRecord(next);
    lastPushedRef.current = JSON.stringify(record);
    onChange(record);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center gap-1.5">
          <Input
            size="sm"
            placeholder="key"
            aria-label="Field name"
            value={row.key}
            onChange={(e) => {
              const next = rows.slice();
              next[index] = { ...row, key: e.target.value };
              commit(next);
            }}
          />
          <Input
            size="sm"
            placeholder="value"
            aria-label="Field value"
            value={row.value}
            onChange={(e) => {
              const next = rows.slice();
              next[index] = { ...row, value: e.target.value };
              commit(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => commit(rows.filter((_, i) => i !== index))}
            aria-label="Remove field">
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => commit([...rows, { id: nextFormRowId(), key: '', value: '' }])}>
        Add field
      </Button>
      <p className="text-muted-foreground text-[10px]">
        Nested values are not representable in form encoding — only flat key/value pairs are sent.
      </p>
    </div>
  );
}
