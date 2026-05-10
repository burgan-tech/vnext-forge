/**
 * Recursive field renderer for `SchemaForm`.
 *
 * Each call renders ONE field — string, number, boolean, enum, oneOf,
 * object, or array. Object & array fields recurse back into this
 * component, so the entire form is built bottom-up by following the
 * JSON Schema's `properties` / `items`. Custom annotations short-circuit
 * the renderer through `findMatchingExtension`.
 */
import { useCallback, useMemo, useState } from 'react';

import { DropdownSelectField } from '../../ui/DropdownSelect';

import { decorateLabel, findMatchingExtension } from './fieldRegistry';
import type {
  FieldErrorMap,
  JsonSchemaPrimitiveType,
  JsonSchemaProperty,
  SchemaFieldContext,
} from './types';

interface SchemaFieldProps {
  name: string;
  prop: JsonSchemaProperty;
  required: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
  context: SchemaFieldContext;
}

function getResolvedType(
  prop: JsonSchemaProperty,
  currentValue: unknown,
): JsonSchemaPrimitiveType | undefined {
  if (Array.isArray(prop.type)) {
    // Pick the first declared type that can accommodate the current value,
    // otherwise the first type in the array.
    for (const t of prop.type) {
      if (
        (t === 'string' && typeof currentValue === 'string') ||
        (t === 'boolean' && typeof currentValue === 'boolean') ||
        (t === 'integer' && Number.isInteger(currentValue as number)) ||
        (t === 'number' && typeof currentValue === 'number') ||
        (t === 'array' && Array.isArray(currentValue)) ||
        (t === 'object' && typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue))
      ) {
        return t;
      }
    }
    return prop.type[0];
  }
  if (prop.type) return prop.type;

  // Fall back to oneOf branches when the top-level schema declares no
  // type. Schemas using Burgan's alternative-types-with-parallel-enums
  // convention (`oneOf: [{type:integer,enum:...}, {type:string,enum:...}]`)
  // don't put a top-level `type`. If the dropdown can't render (option
  // expansion failed or the schema isn't an enum-style oneOf at all),
  // we still want a typed input — prefer the numeric branch so the user
  // gets a number picker for integer codes.
  if (prop.oneOf && prop.oneOf.length > 0) {
    const numericBranch = prop.oneOf.find(
      (branch) => branch.type === 'integer' || branch.type === 'number',
    );
    if (numericBranch?.type) {
      return Array.isArray(numericBranch.type)
        ? numericBranch.type[0]
        : numericBranch.type;
    }
    for (const branch of prop.oneOf) {
      if (typeof branch.type === 'string') {
        return branch.type as JsonSchemaPrimitiveType;
      }
    }
  }

  // Fall back to enum element type (`enum: [0,1,2]` -> integer).
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    const first = prop.enum[0];
    if (typeof first === 'number') {
      return Number.isInteger(first) ? 'integer' : 'number';
    }
    if (typeof first === 'boolean') return 'boolean';
    return 'string';
  }

  return undefined;
}

function inputCls(invalid: boolean): string {
  return [
    'rounded border bg-[var(--vscode-input-background)] px-2 py-1.5 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]',
    invalid
      ? 'border-[var(--vscode-errorForeground)]/60'
      : 'border-[var(--vscode-input-border)]',
  ].join(' ');
}

function ErrorList({ errors }: { errors: string[] | undefined }) {
  if (!errors || errors.length === 0) return null;
  return (
    <ul className="ml-1 mt-0.5 flex flex-col gap-0.5">
      {errors.map((msg, idx) => (
        <li key={idx} className="text-[10px] text-[var(--vscode-errorForeground)]">
          • {msg}
        </li>
      ))}
    </ul>
  );
}

export function SchemaField({
  name,
  prop,
  required,
  value,
  onChange,
  context,
}: SchemaFieldProps) {
  const extension = useMemo(() => findMatchingExtension(prop), [prop]);

  const decorated = useMemo(
    () =>
      decorateLabel(
        prop,
        prop.title ?? name,
        prop.description,
      ),
    [prop, name],
  );

  const errors = context.errors[context.path];
  const invalid = !!errors && errors.length > 0;

  // Custom widget — extension takes over
  if (extension?.render) {
    return (
      <div className="flex flex-col gap-1">
        <FieldLabelRow label={decorated.label} required={required} />
        {decorated.description ? <FieldDesc text={decorated.description} /> : null}
        {extension.render({ prop, value, onChange, context })}
        <ErrorList errors={errors} />
      </div>
    );
  }

  const isOneOf = prop.oneOf && prop.oneOf.length > 0;
  const isEnum = prop.enum && prop.enum.length > 0;
  const resolvedType = getResolvedType(prop, value);

  if (isOneOf) {
    const { options: oneOfOptions, outputType } = expandOneOfToOptions(
      prop.oneOf!,
    );
    if (oneOfOptions.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          <FieldLabelRow label={decorated.label} required={required} />
          {decorated.description ? <FieldDesc text={decorated.description} /> : null}
          <DropdownSelectField
            options={oneOfOptions}
            placeholder="— Select —"
            value={value === undefined || value === null ? '' : String(value)}
            onValueChange={(v) => {
              if (!v) return onChange(undefined);
              onChange(outputType === 'number' ? Number(v) : v);
            }}
            aria-invalid={invalid || undefined}
          />
          <ErrorList errors={errors} />
        </div>
      );
    }
    // Empty options (oneOf shape not understood) → fall through to the
    // default string renderer rather than showing a blank dropdown.
  }

  if (isEnum) {
    // `enum` values are heterogeneous primitives in JSON Schema
    // (string | number | boolean). Same string-bridge trick as oneOf —
    // we map to string for Radix and cast back on output.
    const enumOptions = prop.enum!.map((v) => ({
      value: String(v),
      label: String(v),
    }));
    return (
      <div className="flex flex-col gap-1">
        <FieldLabelRow label={decorated.label} required={required} />
        {decorated.description ? <FieldDesc text={decorated.description} /> : null}
        <DropdownSelectField
          options={enumOptions}
          placeholder="— Select —"
          value={
            value === undefined || value === null ? '' : String(value)
          }
          onValueChange={(v) => {
            if (!v) return onChange(undefined);
            const matched = prop.enum!.find((entry) => String(entry) === v);
            onChange(matched ?? v);
          }}
          aria-invalid={invalid || undefined}
        />
        <ErrorList errors={errors} />
      </div>
    );
  }

  if (resolvedType === 'object' && prop.properties) {
    return (
      <ObjectField
        prop={prop}
        label={decorated.label}
        description={decorated.description}
        required={required}
        value={value}
        onChange={onChange}
        context={context}
      />
    );
  }

  if (resolvedType === 'array') {
    return (
      <ArrayField
        prop={prop}
        label={decorated.label}
        description={decorated.description}
        required={required}
        value={value}
        onChange={onChange}
        context={context}
      />
    );
  }

  if (resolvedType === 'boolean') {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="font-medium">{decorated.label}</span>
          {required ? (
            <span aria-hidden="true" className="text-[var(--vscode-errorForeground)]">
              *
            </span>
          ) : null}
        </label>
        {decorated.description ? <FieldDesc text={decorated.description} /> : null}
        <ErrorList errors={errors} />
      </div>
    );
  }

  if (resolvedType === 'number' || resolvedType === 'integer') {
    return (
      <div className="flex flex-col gap-1">
        <FieldLabelRow label={decorated.label} required={required} />
        {decorated.description ? <FieldDesc text={decorated.description} /> : null}
        <input
          type="number"
          value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(undefined);
            const parsed = Number(raw);
            if (Number.isNaN(parsed)) return;
            onChange(resolvedType === 'integer' ? Math.trunc(parsed) : parsed);
          }}
          step={
            resolvedType === 'integer'
              ? 1
              : prop.multipleOf && prop.multipleOf > 0
                ? prop.multipleOf
                : 'any'
          }
          {...(prop.minimum !== undefined ? { min: prop.minimum } : {})}
          {...(prop.maximum !== undefined ? { max: prop.maximum } : {})}
          aria-invalid={invalid || undefined}
          className={inputCls(invalid)}
        />
        <ErrorList errors={errors} />
      </div>
    );
  }

  // Default: string (with format awareness)
  return (
    <StringField
      prop={prop}
      label={decorated.label}
      description={decorated.description}
      required={required}
      value={value}
      onChange={onChange}
      invalid={invalid}
      errors={errors}
    />
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function FieldLabelRow({ label, required }: { label: string; required: boolean }) {
  return (
    <label className="text-xs font-medium">
      {label}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-[var(--vscode-errorForeground)]">
          *
        </span>
      ) : null}
    </label>
  );
}

function FieldDesc({ text }: { text: string }) {
  return (
    <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">{text}</p>
  );
}

interface CommonInnerProps {
  prop: JsonSchemaProperty;
  label: string;
  description?: string;
  required: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
  context: SchemaFieldContext;
}

function ObjectField({
  prop,
  label,
  description,
  required,
  value,
  onChange,
  context,
}: CommonInnerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const obj = (value as Record<string, unknown> | undefined) ?? {};
  const childRequired = new Set(prop.required ?? []);

  const updateChild = useCallback(
    (key: string, nextValue: unknown) => {
      const next = { ...obj };
      if (nextValue === undefined) {
        delete next[key];
      } else {
        next[key] = nextValue;
      }
      onChange(next);
    },
    [obj, onChange],
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <FieldLabelRow label={label} required={required} />
        <button
          type="button"
          className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={() => setCollapsed((p) => !p)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {description ? <FieldDesc text={description} /> : null}
      {!collapsed ? (
        <div className="ml-2 flex flex-col gap-2 border-l-2 border-[var(--vscode-panel-border)] pl-3">
          {Object.entries(prop.properties ?? {}).map(([key, childProp]) => {
            const childPath = context.path ? `${context.path}.${key}` : key;
            const childContext: SchemaFieldContext = {
              path: childPath,
              required: childRequired.has(key),
              errors: context.errors,
              rootValue: context.rootValue,
            };
            return (
              <SchemaField
                key={key}
                name={key}
                prop={childProp}
                required={childRequired.has(key)}
                value={obj[key]}
                onChange={(v) => updateChild(key, v)}
                context={childContext}
              />
            );
          })}
        </div>
      ) : null}
    </fieldset>
  );
}

function ArrayField({
  prop,
  label,
  description,
  required,
  value,
  onChange,
  context,
}: CommonInnerProps) {
  const list: unknown[] = Array.isArray(value) ? value : [];
  const itemSchema = prop.items ?? { type: 'string' };
  const errors = context.errors[context.path];

  const addItem = () => {
    const next = [...list];
    next.push(defaultValueForSchema(itemSchema));
    onChange(next);
  };

  const removeItem = (idx: number) => {
    const next = list.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = list.slice();
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    onChange(next);
  };

  const updateItem = (idx: number, nextValue: unknown) => {
    const next = list.slice();
    next[idx] = nextValue;
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <FieldLabelRow label={label} required={required} />
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          {list.length} item{list.length === 1 ? '' : 's'}
        </span>
      </div>
      {description ? <FieldDesc text={description} /> : null}
      <div className="ml-2 flex flex-col gap-2 border-l-2 border-[var(--vscode-panel-border)] pl-3">
        {list.length === 0 ? (
          <p className="text-[10px] italic text-[var(--vscode-descriptionForeground)]">
            (empty)
          </p>
        ) : null}
        {list.map((item, idx) => {
          const childPath = `${context.path ? `${context.path}.` : ''}${idx}`;
          const childContext: SchemaFieldContext = {
            path: childPath,
            required: false,
            errors: context.errors,
            rootValue: context.rootValue,
          };
          return (
            <div
              key={idx}
              className="flex flex-col gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-list-hoverBackground)]/30 p-2"
            >
              <div className="flex items-center justify-between text-[10px] text-[var(--vscode-descriptionForeground)]">
                <span>#{idx + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded border border-[var(--vscode-panel-border)] px-1 hover:bg-[var(--vscode-list-hoverBackground)]"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--vscode-panel-border)] px-1 hover:bg-[var(--vscode-list-hoverBackground)]"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === list.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--vscode-panel-border)] px-1 text-[var(--vscode-errorForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
                    onClick={() => removeItem(idx)}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <SchemaField
                name={String(idx)}
                prop={itemSchema}
                required={false}
                value={item}
                onChange={(v) => updateItem(idx, v)}
                context={childContext}
              />
            </div>
          );
        })}
        <button
          type="button"
          onClick={addItem}
          className="self-start rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          + Add item
        </button>
      </div>
      <ErrorList errors={errors} />
    </fieldset>
  );
}

interface StringFieldProps extends Omit<CommonInnerProps, 'context'> {
  invalid: boolean;
  errors: string[] | undefined;
}

function StringField({
  prop,
  label,
  description,
  required,
  value,
  onChange,
  invalid,
  errors,
}: StringFieldProps) {
  const format = prop.format;
  const inputType = ((): string => {
    switch (format) {
      case 'date':
        return 'date';
      case 'date-time':
        return 'datetime-local';
      case 'time':
        return 'time';
      case 'email':
        return 'email';
      case 'uri':
      case 'url':
        return 'url';
      case 'password':
        return 'password';
      default:
        return 'text';
    }
  })();

  const useTextarea = format === 'textarea' || (prop.maxLength ?? 0) > 200;

  const stringValue = typeof value === 'string' ? value : '';

  if (useTextarea) {
    return (
      <div className="flex flex-col gap-1">
        <FieldLabelRow label={label} required={required} />
        {description ? <FieldDesc text={description} /> : null}
        <textarea
          value={stringValue}
          onChange={(e) => onChange(e.target.value || undefined)}
          rows={4}
          {...(prop.minLength !== undefined ? { minLength: prop.minLength } : {})}
          {...(prop.maxLength !== undefined ? { maxLength: prop.maxLength } : {})}
          {...(prop.pattern ? { pattern: prop.pattern } : {})}
          aria-invalid={invalid || undefined}
          className={inputCls(invalid)}
        />
        <ErrorList errors={errors} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <FieldLabelRow label={label} required={required} />
      {description ? <FieldDesc text={description} /> : null}
      <input
        type={inputType}
        value={stringValue}
        onChange={(e) => onChange(e.target.value || undefined)}
        {...(prop.minLength !== undefined ? { minLength: prop.minLength } : {})}
        {...(prop.maxLength !== undefined ? { maxLength: prop.maxLength } : {})}
        {...(prop.pattern ? { pattern: prop.pattern } : {})}
        aria-invalid={invalid || undefined}
        className={inputCls(invalid)}
      />
      <ErrorList errors={errors} />
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Produce a sensible empty value for a schema. Used when the user clicks
 * "Add item" so the new row doesn't trip the type-check immediately.
 */
export function defaultValueForSchema(prop: JsonSchemaProperty): unknown {
  if (prop.default !== undefined) return prop.default;
  const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
  switch (type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object': {
      const result: Record<string, unknown> = {};
      for (const [key, childProp] of Object.entries(prop.properties ?? {})) {
        if (childProp.default !== undefined) result[key] = childProp.default;
      }
      return result;
    }
    case 'null':
      return null;
    default:
      return undefined;
  }
}

/**
 * Resolve a JSON Schema `oneOf` into a flat list of dropdown options.
 *
 * vnext schemas (and many OpenAPI-style schemas) use two distinct
 * `oneOf` conventions:
 *
 *  1. **Typed-enum-with-descriptions** — each branch is a single
 *     `const` with a human-readable `description`:
 *
 *     ```json
 *     "oneOf": [
 *       { "const": 0, "description": "AutoDetect" },
 *       { "const": 1, "description": "Burgan" }
 *     ]
 *     ```
 *
 *  2. **Alternative-types with parallel enums** (Burgan convention) —
 *     two branches, one with the integer codes, one with the string
 *     names, paired by index:
 *
 *     ```json
 *     "oneOf": [
 *       { "type": "integer", "enum": [0, 1, 2] },
 *       { "type": "string",  "enum": ["AutoDetect", "Burgan", "On"] }
 *     ]
 *     ```
 *
 * The function detects which pattern is in play, returns options with
 * human-readable labels, and tells the caller whether to cast the
 * picked value to a number or keep it as a string.
 */
export function expandOneOfToOptions(
  oneOf: ReadonlyArray<JsonSchemaProperty>,
): {
  options: Array<{ value: string; label: string }>;
  outputType: 'number' | 'string';
} {
  if (oneOf.length === 0) return { options: [], outputType: 'string' };

  // ── Case A: typed-const style ────────────────────────────────────────────
  if (oneOf.every((branch) => branch.const !== undefined)) {
    const allNumeric = oneOf.every(
      (branch) =>
        typeof branch.const === 'number' ||
        /^-?\d+(\.\d+)?$/.test(String(branch.const)),
    );
    return {
      options: oneOf.map((branch) => ({
        value: String(branch.const),
        label: branch.description ?? branch.title ?? String(branch.const),
      })),
      outputType: allNumeric ? 'number' : 'string',
    };
  }

  // ── Case B: alternative-types with parallel enums ────────────────────────
  const enumBranches = oneOf.filter(
    (branch): branch is JsonSchemaProperty & { enum: ReadonlyArray<unknown> } =>
      Array.isArray(branch.enum) && branch.enum.length > 0,
  );

  if (enumBranches.length === oneOf.length && enumBranches.length > 0) {
    const numericBranch = enumBranches.find(
      (branch) => branch.type === 'integer' || branch.type === 'number',
    );
    const stringBranch = enumBranches.find((branch) => branch.type === 'string');

    if (
      numericBranch &&
      stringBranch &&
      numericBranch.enum.length === stringBranch.enum.length
    ) {
      return {
        options: numericBranch.enum.map((v, i) => ({
          value: String(v),
          label: `${String(stringBranch.enum[i])} (${String(v)})`,
        })),
        outputType: 'number',
      };
    }

    // Fallback: flatten all enum values, dedupe by string repr.
    const seen = new Set<string>();
    const collected: { value: string; label: string }[] = [];
    for (const branch of enumBranches) {
      for (const v of branch.enum) {
        const sv = String(v);
        if (seen.has(sv)) continue;
        seen.add(sv);
        collected.push({ value: sv, label: sv });
      }
    }
    const allNumeric = collected.every((o) => /^-?\d+(\.\d+)?$/.test(o.value));
    return {
      options: collected,
      outputType: allNumeric ? 'number' : 'string',
    };
  }

  // ── No recognised pattern ────────────────────────────────────────────────
  return { options: [], outputType: 'string' };
}
