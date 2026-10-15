import { useEffect, useId, useState } from 'react';

import type { SchemaRole } from '@vnext-forge-studio/vnext-types';

import { Field } from '../../../ui/Field';
import { useFormReadOnly } from '../../../ui/FormReadOnlyContext';
import { SCHEMA_TYPE_SUGGESTIONS } from '../SchemaEditorSchema';
import { SCHEMA_ROLE_OPTIONS, classifySchemaType, schemaRolesEnforced } from '../model/schemaRoles';
import { schemaTypeVersionHint } from '../schemaTypeVersionHint';

export interface SchemaTypeFieldProps {
  value: string;
  /** `''` removes `attributes.type` (no role). */
  onCommit: (next: string) => void;
  errorMsg?: string;
  /** The project's pinned `vnext.config.json#schemaVersion`, when known. */
  schemaVersion?: string;
  /** Role inferred from where the schema is referenced, offered for a legacy value. */
  suggestedRole?: SchemaRole;
}

/**
 * `attributes.type` editor. From vnext-schema 0.0.56 the type is an optional
 * role that gates the schema's `x-*` annotations, so the field is a role
 * picker; older pins keep the free-text input their package accepts.
 */
export function SchemaTypeField(props: SchemaTypeFieldProps) {
  return schemaRolesEnforced(props.schemaVersion) ? <SchemaRoleSelect {...props} /> : <LegacySchemaTypeInput {...props} />;
}

const selectClassName =
  'w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all';

function SchemaRoleSelect({ value, onCommit, errorMsg, suggestedRole }: SchemaTypeFieldProps) {
  const readOnly = useFormReadOnly();
  const current = classifySchemaType(value);
  const selected = SCHEMA_ROLE_OPTIONS.find((option) => current.kind === 'role' && option.role === current.role);

  return (
    <Field
      label="Schema role"
      errorMsg={errorMsg}
      hint={
        selected ? (
          selected.description
        ) : (
          <>No role: every annotation except x-indexed is accepted. Pick a role to get its checks.</>
        )
      }>
      <select
        value={current.kind === 'legacy' ? current.value : value}
        disabled={readOnly}
        aria-label="Schema role"
        aria-invalid={Boolean(errorMsg) || current.kind === 'legacy'}
        onChange={(e) => {
          if (e.target.value !== value) onCommit(e.target.value);
        }}
        className={selectClassName}>
        <option value="">No role</option>
        {SCHEMA_ROLE_OPTIONS.map((option) => (
          <option key={option.role} value={option.role}>
            {option.label}
          </option>
        ))}
        {current.kind === 'legacy' ? (
          <option value={current.value} disabled>
            {current.value} (legacy)
          </option>
        ) : null}
      </select>
      {current.kind === 'legacy' ? (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400" role="alert">
          <span>
            <code>{current.value}</code> is a legacy type. vnext-schema {'≥'} 0.0.56 accepts only a role or no type,
            so validation fails until you pick one.
          </span>
          {suggestedRole && !readOnly ? (
            <button
              type="button"
              onClick={() => onCommit(suggestedRole)}
              className="text-secondary-icon hover:text-secondary-foreground cursor-pointer font-semibold underline">
              Use {suggestedRole}
            </button>
          ) : null}
        </div>
      ) : null}
    </Field>
  );
}

/**
 * Free-text `attributes.type` input with suggestions (native `<datalist>`) for
 * projects pinned below 0.0.56. Commits on blur or Enter so the document is
 * not rewritten per keystroke; blank input reverts because the field is a
 * required string there.
 */
function LegacySchemaTypeInput({ value, onCommit, errorMsg, schemaVersion }: SchemaTypeFieldProps) {
  const listId = useId();
  const readOnly = useFormReadOnly();
  const [draft, setDraft] = useState(value);
  const versionHint = schemaTypeVersionHint(value, schemaVersion);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setDraft(value);
      return;
    }
    if (trimmed !== value) onCommit(trimmed);
  };

  return (
    <Field
      label="Schema type"
      required
      errorMsg={errorMsg}
      hint={
        <>
          Free text. Only <code>master</code> permits x-indexed.
        </>
      }>
      <input
        type="text"
        list={listId}
        value={draft}
        readOnly={readOnly}
        aria-label="Schema type"
        aria-invalid={Boolean(errorMsg)}
        placeholder="master"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(value);
        }}
        className="w-full px-3 py-2 text-xs font-mono border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all placeholder:text-subtle"
      />
      <datalist id={listId}>
        {SCHEMA_TYPE_SUGGESTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {versionHint && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400" role="alert">
          {versionHint}
        </p>
      )}
    </Field>
  );
}
