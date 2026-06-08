import { type JsonPointer } from '../../../model/jsonPointer';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

// Boolean toggle, no body controls. The vocab contract is:
//   - `x-sortable: true`  → field is sortable
//   - absent              → not sortable
// The card's toggle directly drives this: enable installs `true`,
// disable deletes the key.
const DEFAULT_VALUE = (): boolean => true;

interface XSortableCardProps {
  pointer: JsonPointer;
}

/**
 * `x-sortable` marks the field as sortable in tabular / list views.
 * Persisted shape: boolean `true`. Absent (card disabled) means the
 * field is not sortable.
 */
export function XSortableCard({ pointer }: XSortableCardProps) {
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-sortable', DEFAULT_VALUE);

  return (
    <VNextCardShell
      xKey="x-sortable"
      title="Sortable"
      purpose="When enabled, this field is sortable in tabular / list views."
      enabled={enabled}
      onToggle={toggle}>
      <p className="text-[10px] text-primary-text/65">
        Toggle off to remove the annotation (field becomes unsortable).
      </p>
    </VNextCardShell>
  );
}
