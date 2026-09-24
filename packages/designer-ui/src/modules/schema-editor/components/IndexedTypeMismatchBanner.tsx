import { AlertTriangle } from 'lucide-react';

import { Button } from '../../../ui/Button';
import { useFormReadOnly } from '../../../ui/FormReadOnlyContext';
import { indexTypeMismatch } from '../model/indexEligibility';
import { removeIndexedKeywords } from '../model/mutators';

interface IndexedTypeMismatchBannerProps {
  json: Record<string, unknown>;
  onChange: (updater: (draft: Record<string, unknown>) => void) => void;
}

/** D3: x-indexed anywhere while attributes.type is not master — the runtime rejects the schema at publish. */
export function IndexedTypeMismatchBanner({ json, onChange }: IndexedTypeMismatchBannerProps) {
  const readOnly = useFormReadOnly();
  const mismatch = indexTypeMismatch(json);
  if (!mismatch) return null;
  const count = mismatch.indexedPointers.length;
  const typeLabel = mismatch.schemaType?.trim() ? mismatch.schemaType : '(not set)';

  return (
    <div
      role="alert"
      className="border-warning-border bg-warning text-warning-foreground flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 text-xs">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">
        This schema declares x-indexed on {count} {count === 1 ? 'field' : 'fields'}, but attributes.type is{' '}
        <span className="font-mono">{typeLabel}</span>. Only master schemas may declare x-indexed; the runtime
        rejects this schema at publish. Set the schema type to master or remove the flags.
      </p>
      {!readOnly && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(removeIndexedKeywords(mismatch.indexedPointers))}>
          Remove all x-indexed
        </Button>
      )}
    </div>
  );
}
