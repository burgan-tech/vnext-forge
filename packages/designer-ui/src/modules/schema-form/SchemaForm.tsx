/**
 * Schema-driven form for arbitrary JSON Schemas.
 *
 * Mirrors the inline renderer that originally lived inside
 * `quick-run/components/TransitionDialog.tsx`, with these improvements:
 *
 *  - **Array fields** with add / remove / reorder
 *  - **Format-aware inputs** (date, datetime-local, email, url, password,
 *    multi-line for `format: 'textarea'`)
 *  - **Inline client-side validation** (required, type, format, min/max,
 *    pattern, multipleOf, uniqueItems) — server-side AJV still runs on
 *    submit, this is just immediate UX feedback while the user types
 *  - **Field extension registry** so Burgan-specific annotations
 *    (`x-localization`, `x-remote-service`, ...) plug in without
 *    forking the renderer
 *  - **Form / JSON toggle** preserved — sometimes JSON is the fastest
 *    path
 *
 * The component is intentionally controlled and stateless: it takes a
 * JSON-string `value`, a JSON Schema, and pushes a JSON-string back via
 * `onChange`. Hosts that already keep the payload as a parsed object can
 * use `objectValue` / `onObjectChange` instead.
 */
import { useCallback, useMemo, useState } from 'react';

import { JsonEditorWithCopy } from '../quick-run/components/CopyableJsonBlock';

import { defaultValueForSchema, SchemaField } from './SchemaField';
import type {
  FieldErrorMap,
  JsonSchemaProperty,
  JsonSchemaRoot,
  SchemaFieldContext,
} from './types';
import { validateAgainstSchema } from './validateSchema';

interface SchemaFormCommonProps {
  /** JSON Schema root. When `null` / undefined the form falls back to JSON. */
  schema: JsonSchemaRoot | null | undefined;
  /**
   * Whether to render the "Switch to JSON" toggle. Hosts can hide it when
   * the surrounding UI already provides its own JSON view.
   */
  showRawToggle?: boolean;
  /**
   * Number of rows for the JSON fallback editor.
   */
  jsonEditorRows?: number;
  /**
   * Optional label for the JSON fallback editor (defaults to "Payload (JSON)").
   */
  jsonEditorLabel?: string;
  /**
   * Force-show validation errors even before the user has interacted with
   * a field. By default we only show errors after the user has typed or
   * clicked submit (parent toggles `showAllErrors` at submit time).
   */
  showAllErrors?: boolean;
}

interface SchemaFormStringValueProps extends SchemaFormCommonProps {
  /** Stringified JSON payload. */
  value: string;
  onChange: (next: string) => void;
  objectValue?: never;
  onObjectChange?: never;
}

interface SchemaFormObjectValueProps extends SchemaFormCommonProps {
  objectValue: Record<string, unknown>;
  onObjectChange: (next: Record<string, unknown>) => void;
  value?: never;
  onChange?: never;
}

export type SchemaFormProps = SchemaFormStringValueProps | SchemaFormObjectValueProps;

/**
 * Public entry point. Delegates to the internal controlled implementation
 * regardless of whether the host owns the value as a string or an object.
 */
export function SchemaForm(props: SchemaFormProps) {
  if ('objectValue' in props && props.objectValue !== undefined) {
    return (
      <SchemaFormObject
        schema={props.schema}
        showRawToggle={props.showRawToggle}
        jsonEditorRows={props.jsonEditorRows}
        jsonEditorLabel={props.jsonEditorLabel}
        showAllErrors={props.showAllErrors}
        value={props.objectValue}
        onChange={props.onObjectChange!}
      />
    );
  }
  return (
    <SchemaFormString
      schema={props.schema}
      showRawToggle={props.showRawToggle}
      jsonEditorRows={props.jsonEditorRows}
      jsonEditorLabel={props.jsonEditorLabel}
      showAllErrors={props.showAllErrors}
      value={(props as SchemaFormStringValueProps).value}
      onChange={(props as SchemaFormStringValueProps).onChange!}
    />
  );
}

// ── Implementations ─────────────────────────────────────────────────────────

interface SchemaFormStringInternalProps extends SchemaFormCommonProps {
  value: string;
  onChange: (next: string) => void;
}

function SchemaFormString({
  schema,
  value,
  onChange,
  showRawToggle = true,
  jsonEditorRows = 12,
  jsonEditorLabel = 'Payload (JSON)',
  showAllErrors,
}: SchemaFormStringInternalProps) {
  const parsed = useMemo<Record<string, unknown>>(() => {
    if (!value || !value.trim() || value.trim() === '{}') return {};
    try {
      const result = JSON.parse(value) as unknown;
      return typeof result === 'object' && result !== null && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }, [value]);

  const handleObjectChange = useCallback(
    (next: Record<string, unknown>) => {
      onChange(JSON.stringify(next, null, 2));
    },
    [onChange],
  );

  return (
    <SchemaFormCore
      schema={schema}
      objectValue={parsed}
      onObjectChange={handleObjectChange}
      stringValue={value}
      stringOnChange={onChange}
      showRawToggle={showRawToggle}
      jsonEditorRows={jsonEditorRows}
      jsonEditorLabel={jsonEditorLabel}
      showAllErrors={showAllErrors}
    />
  );
}

interface SchemaFormObjectInternalProps extends SchemaFormCommonProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

function SchemaFormObject({
  schema,
  value,
  onChange,
  showRawToggle = true,
  jsonEditorRows = 12,
  jsonEditorLabel = 'Payload (JSON)',
  showAllErrors,
}: SchemaFormObjectInternalProps) {
  const stringValue = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const handleStringChange = useCallback(
    (next: string) => {
      try {
        const parsed = JSON.parse(next) as unknown;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          onChange(parsed as Record<string, unknown>);
        }
      } catch {
        // ignore JSON syntax errors while typing — the editor itself shows them
      }
    },
    [onChange],
  );

  return (
    <SchemaFormCore
      schema={schema}
      objectValue={value}
      onObjectChange={onChange}
      stringValue={stringValue}
      stringOnChange={handleStringChange}
      showRawToggle={showRawToggle}
      jsonEditorRows={jsonEditorRows}
      jsonEditorLabel={jsonEditorLabel}
      showAllErrors={showAllErrors}
    />
  );
}

// ── Core (shared) ───────────────────────────────────────────────────────────

interface SchemaFormCoreProps extends SchemaFormCommonProps {
  objectValue: Record<string, unknown>;
  onObjectChange: (next: Record<string, unknown>) => void;
  stringValue: string;
  stringOnChange: (next: string) => void;
}

function SchemaFormCore({
  schema,
  objectValue,
  onObjectChange,
  stringValue,
  stringOnChange,
  showRawToggle,
  jsonEditorRows,
  jsonEditorLabel,
  showAllErrors,
}: SchemaFormCoreProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());

  const properties = (schema?.properties ?? {}) as Record<string, JsonSchemaProperty>;
  const required = useMemo(
    () => new Set(schema?.required ?? []),
    [schema?.required],
  );
  const propEntries = Object.entries(properties);

  const errors = useMemo<FieldErrorMap>(
    () => validateAgainstSchema(schema ?? undefined, objectValue),
    [schema, objectValue],
  );

  // Filter errors to only those whose field has been touched, unless the
  // host forces "show everything" (e.g. on submit attempt).
  const visibleErrors = useMemo<FieldErrorMap>(() => {
    if (showAllErrors) return errors;
    const out: FieldErrorMap = {};
    for (const [path, list] of Object.entries(errors)) {
      if (touched.has(path) || pathHasTouchedAncestor(touched, path)) {
        out[path] = list;
      }
    }
    return out;
  }, [errors, touched, showAllErrors]);

  const updateField = useCallback(
    (key: string, fieldValue: unknown) => {
      const next = { ...objectValue };
      if (fieldValue === undefined) {
        delete next[key];
      } else {
        next[key] = fieldValue;
      }
      onObjectChange(next);
      setTouched((prev) => {
        const nextSet = new Set(prev);
        nextSet.add(key);
        return nextSet;
      });
    },
    [objectValue, onObjectChange],
  );

  // ── Empty / missing schema → JSON fallback ───────────────────────────────
  if (!schema || propEntries.length === 0) {
    return (
      <JsonEditorWithCopy
        label={jsonEditorLabel ?? ''}
        value={stringValue}
        onChange={stringOnChange}
        rows={jsonEditorRows ?? 12}
      />
    );
  }

  // ── Raw JSON toggle ──────────────────────────────────────────────────────
  if (showRaw) {
    return (
      <div className="flex flex-col gap-1">
        {showRawToggle ? (
          <div className="flex items-center justify-end">
            <button
              type="button"
              className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
              onClick={() => setShowRaw(false)}
            >
              Switch to Form
            </button>
          </div>
        ) : null}
        <JsonEditorWithCopy
          label={jsonEditorLabel ?? ''}
          value={stringValue}
          onChange={stringOnChange}
          rows={jsonEditorRows ?? 12}
        />
      </div>
    );
  }

  // ── Default: form view ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          {schema.title ? (
            <p className="text-xs font-semibold">{schema.title}</p>
          ) : null}
          {schema.description ? (
            <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">
              {schema.description}
            </p>
          ) : null}
        </div>
        {showRawToggle ? (
          <button
            type="button"
            className="shrink-0 text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
            onClick={() => setShowRaw(true)}
          >
            Switch to JSON
          </button>
        ) : null}
      </div>

      {propEntries.map(([key, prop]) => {
        const childPath = key;
        const childContext: SchemaFieldContext = {
          path: childPath,
          required: required.has(key),
          errors: visibleErrors,
          rootValue: objectValue,
        };
        return (
          <SchemaField
            key={key}
            name={key}
            prop={prop}
            required={required.has(key)}
            value={objectValue[key]}
            onChange={(v) => updateField(key, v)}
            context={childContext}
          />
        );
      })}
    </div>
  );
}

function pathHasTouchedAncestor(touched: Set<string>, path: string): boolean {
  // For a path like "deactivatedBy.name", we treat it as "touched" once
  // the user touched the parent group — otherwise opening a fresh dialog
  // would silently mark every nested required as in-error which is noisy.
  let cur = path;
  while (true) {
    const idx = cur.lastIndexOf('.');
    if (idx < 0) return false;
    cur = cur.slice(0, idx);
    if (touched.has(cur)) return true;
  }
}

// Re-export the helper so consumers can pre-fill arrays / objects with
// schema-driven defaults outside of the form itself.
export { defaultValueForSchema };
