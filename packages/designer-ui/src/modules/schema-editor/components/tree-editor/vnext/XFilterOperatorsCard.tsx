import { Checkbox } from '../../../../../ui/Checkbox';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';
import { FILTER_OPERATORS, mergeOperators, splitOperators, type FilterOperator } from './filterOperators';

const CATEGORIES = ['Equality', 'Comparison', 'Text', 'Membership'] as const;

// Seed with the most common operator so the toggle-on state is
// immediately valid (vocab allows empty array but it's semantically
// equivalent to "not filterable" → users should toggle the whole
// card off in that case).
const DEFAULT_VALUE = (): FilterOperator[] => ['eq'];

interface XFilterOperatorsCardProps {
  pointer: JsonPointer;
}

/**
 * `x-filterOperators` lists the filter operators a tabular consumer
 * may apply to this field. Persisted shape: an array of strings drawn
 * from `eq | ne | gt | ge | lt | le | between | match | like |
 * startswith | endswith | in | nin`. Empty or absent → field is not
 * filterable.
 */
export function XFilterOperatorsCard({ pointer }: XFilterOperatorsCardProps) {
  const readOnly = useFormReadOnly();
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-filterOperators', DEFAULT_VALUE);
  const { known: value, unknown: preserved } = splitOperators(node?.['x-filterOperators']);
  const selected = new Set(value);

  function setOperator(op: FilterOperator, on: boolean): void {
    const next = new Set(value);
    if (on) next.add(op);
    else next.delete(op);
    updateComponent(setKeyword(pointer, 'x-filterOperators', mergeOperators(next, preserved)));
  }

  return (
    <VNextCardShell
      xKey="x-filterOperators"
      title="Filter operators"
      purpose="Operators a tabular consumer may apply to this field. Turn off the card to remove all operators (field becomes unfilterable)."
      enabled={enabled}
      onToggle={toggle}>
      <div className="space-y-2">
        {CATEGORIES.map((category) => {
          const ops = FILTER_OPERATORS.filter((o) => o.category === category);
          return (
            <div key={category}>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-primary-text/55">
                {category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ops.map((op) => {
                  const id = `filter-op-${pointer.replace(/\W+/g, '_')}-${op.value}`;
                  const checked = selected.has(op.value);
                  return (
                    <label
                      key={op.value}
                      htmlFor={id}
                      className={
                        readOnly
                          ? 'pointer-events-none flex items-center gap-1 rounded-md border border-primary-border/60 bg-primary-muted/30 px-2 py-1 text-[10px] font-mono'
                          : 'flex cursor-pointer items-center gap-1 rounded-md border border-primary-border/60 bg-primary-muted/30 px-2 py-1 text-[10px] font-mono hover:bg-primary-muted/60'
                      }>
                      {/* Read-only: non-interactive, not disabled/gray. */}
                      <Checkbox
                        id={id}
                        checked={checked}
                        aria-readonly={readOnly || undefined}
                        tabIndex={readOnly ? -1 : undefined}
                        className={readOnly ? 'pointer-events-none' : undefined}
                        onCheckedChange={(next) => {
                          if (readOnly) {
                            return;
                          }
                          setOperator(op.value, next === true);
                        }}
                      />
                      <span>{op.value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {preserved.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Also kept: <span className="font-mono">{preserved.join(', ')}</span>
        </p>
      )}
    </VNextCardShell>
  );
}
