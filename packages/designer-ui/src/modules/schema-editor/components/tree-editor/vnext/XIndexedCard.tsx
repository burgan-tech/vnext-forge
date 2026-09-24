import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import {
  INDEX_MESSAGES,
  getIndexAnalysis,
  indexColumnsFor,
  indexInfoAt,
  indexViolationFor,
  type IndexColumnType,
  type IndexNodeInfo,
} from '../../../model/indexEligibility';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

const DEFAULT_VALUE = (): boolean => true;

export interface XIndexedCardViewProps {
  pointer: JsonPointer;
  enabled: boolean;
  /** Raw `x-indexed` value. */
  value: unknown;
  info: IndexNodeInfo;
  columns: IndexColumnType[];
  violation: string | null;
  onToggle: () => void;
  onSelect: (next: boolean) => void;
}

/**
 * `x-indexed` tri-state: unset (card off), `true`, `false`. Enabling is
 * blocked with the eligibility reason while unset; a value that is already set
 * stays removable and shows why the runtime would reject it.
 */
export function XIndexedCardView({
  pointer,
  enabled,
  value,
  info,
  columns,
  violation,
  onToggle,
  onSelect,
}: XIndexedCardViewProps) {
  const readOnly = useFormReadOnly();
  const blocked = !enabled && !info.eligible;
  const blockedReason = blocked ? INDEX_MESSAGES[info.reason ?? 'dynamicLocation'] : undefined;

  return (
    <VNextCardShell
      xKey="x-indexed"
      title="Indexed"
      purpose="Ask for a database index column for this field. Master schemas only."
      enabled={enabled}
      onToggle={onToggle}
      toggleDisabled={blocked}
      toggleDisabledReason={blockedReason}
      error={violation ?? undefined}>
      <div role="radiogroup" aria-label="x-indexed value" className="flex flex-wrap gap-3">
        {[true, false].map((option) => (
          <label
            key={String(option)}
            className={
              readOnly
                ? 'pointer-events-none flex items-center gap-1.5 text-[11px]'
                : 'flex cursor-pointer items-center gap-1.5 text-[11px]'
            }>
            <input
              type="radio"
              name={`x-indexed-${pointer}`}
              checked={value === option}
              aria-readonly={readOnly || undefined}
              tabIndex={readOnly ? -1 : undefined}
              disabled={option && !info.eligible && value !== true}
              onChange={() => {
                if (!readOnly) onSelect(option);
              }}
            />
            {option ? 'Indexed (true)' : 'Not indexed (false)'}
          </label>
        ))}
      </div>
      {value === true && columns.length > 0 ? (
        <p className="text-[10px] text-primary-text/75">
          Produces columns: <span className="font-mono">{columns.join(', ')}</span>
        </p>
      ) : null}
      <p className="text-[10px] text-primary-text/65">
        Indexing does not make the field filterable or sortable; use x-filterOperators and x-sortable for that.
        The index SQL comes from <code>wf indexes generate</code> and is run by a DBA.
      </p>
    </VNextCardShell>
  );
}

interface XIndexedCardProps {
  pointer: JsonPointer;
}

/** Store shell: feeds the node, its eligibility and its violation into the view. */
export function XIndexedCard({ pointer }: XIndexedCardProps) {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { node } = useSchemaNode(pointer);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-indexed', DEFAULT_VALUE);
  const info = indexInfoAt(getIndexAnalysis(componentJson), pointer);

  return (
    <XIndexedCardView
      pointer={pointer}
      enabled={enabled}
      value={node?.['x-indexed']}
      info={info}
      columns={indexColumnsFor(node)}
      violation={indexViolationFor(info)?.message ?? null}
      onToggle={toggle}
      onSelect={(next) => updateComponent(setKeyword(pointer, 'x-indexed', next))}
    />
  );
}
