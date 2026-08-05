import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { JsonEditorWithCopy } from '../../quick-run/components/CopyableJsonBlock';
import { SchemaForm } from '../../schema-form';
import type { JsonSchemaRoot } from '../../schema-form';
import { CONTENT_TYPES, type ContentTypeId } from '../functionRunPayload';

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
 * Free JSON editor for when the contract declares no input schema.
 *
 * Kept as its own controlled loop, decoupled from the parent's `value` via
 * `isLocalEchoRef`: the editor's own text is the source of truth for what
 * is on screen, and the parent only ever receives *valid* parsed objects.
 * Without this, a controlled `<JsonEditorWithCopy value=… onChange=…>` fed
 * straight from the parent's `Record` would have nothing to show while the
 * user's in-progress text fails to parse — the parent's `value` cannot
 * represent "half-typed JSON", so the editor would either freeze on the
 * last good object mid-keystroke or, worse, echo the parent's unchanged
 * `value` back over the user's own typing on the next unrelated re-render.
 * The ref flag distinguishes "this change came from us, don't resync" from
 * a genuine external reset (switching function, clearing the form).
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
  const isLocalEchoRef = useRef(false);

  useEffect(() => {
    if (isLocalEchoRef.current) {
      isLocalEchoRef.current = false;
      return;
    }
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
      isLocalEchoRef.current = true;
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

function toFormRows(value: Record<string, unknown>): FormRow[] {
  return Object.entries(value).map(([key, v]) => ({
    id: nextFormRowId(),
    key,
    value: typeof v === 'string' ? v : v == null ? '' : String(v),
  }));
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
 * Key/value rows for `application/x-www-form-urlencoded`. Nested values
 * cannot survive this encoding, so a hint says so instead of silently
 * flattening a nested object into `"[object Object]"`.
 */
function FormRows({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const [rows, setRows] = useState<FormRow[]>(() => toFormRows(value));
  const isLocalEchoRef = useRef(false);

  useEffect(() => {
    if (isLocalEchoRef.current) {
      isLocalEchoRef.current = false;
      return;
    }
    setRows(toFormRows(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(next: FormRow[]) {
    setRows(next);
    isLocalEchoRef.current = true;
    onChange(formRowsToRecord(next));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center gap-1.5">
          <Input
            size="sm"
            placeholder="key"
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
