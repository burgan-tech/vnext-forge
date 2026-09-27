import { AlertTriangle } from 'lucide-react';

import type { IndexTypeMismatch } from '../../../../schema-editor/model/indexEligibility';

export interface SchemaIndexTypeWarningProps {
  schemaKey: string;
  mismatch: IndexTypeMismatch | null;
}

/** D6: the workflow's master schema declares x-indexed but is not typed master. */
export function SchemaIndexTypeWarning({ schemaKey, mismatch }: SchemaIndexTypeWarningProps) {
  if (!mismatch) return null;
  const count = mismatch.indexedPointers.length;
  const typeLabel = mismatch.schemaType?.trim() ? mismatch.schemaType : '(not set)';

  return (
    <div
      role="alert"
      className="border-warning-border bg-warning text-warning-foreground flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        Schema <span className="font-mono">{schemaKey}</span> declares x-indexed on {count}{' '}
        {count === 1 ? 'field' : 'fields'}, but its attributes.type is{' '}
        <span className="font-mono">{typeLabel}</span>. Only master schemas may declare x-indexed; the runtime
        rejects it at publish. Open the schema and set its type to master, or remove the flags.
      </span>
    </div>
  );
}
