import { useEffect, useId, useState } from 'react';

import { Field } from '../../../ui/Field';
import { useFormReadOnly } from '../../../ui/FormReadOnlyContext';
import { SCHEMA_TYPE_SUGGESTIONS } from '../SchemaEditorSchema';
import { schemaTypeVersionHint } from '../schemaTypeVersionHint';

export interface SchemaTypeFieldProps {
  value: string;
  onCommit: (next: string) => void;
  errorMsg?: string;
  /** The project's pinned `vnext.config.json#schemaVersion`, when known. */
  schemaVersion?: string;
}

/**
 * Free-text `attributes.type` input with suggestions (native `<datalist>`).
 * Commits on blur or Enter so the document is not rewritten per keystroke;
 * blank input reverts because the field is a required string.
 */
export function SchemaTypeField({ value, onCommit, errorMsg, schemaVersion }: SchemaTypeFieldProps) {
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
