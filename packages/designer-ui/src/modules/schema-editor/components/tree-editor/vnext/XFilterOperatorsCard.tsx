import { Checkbox } from '../../../../../ui/Checkbox';
import { useFormReadOnly } from '../../../../../ui/FormReadOnlyContext';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';
import {
  FILTER_OPERATOR_CATEGORIES,
  FILTER_OPERATORS,
  mergeOperators,
  splitOperators,
  type FilterOperator,
} from './filterOperators';

// Seed with the most common operator so the toggle-on state is immediately
// valid (an empty list means "not filterable" — toggle the card off instead).
const DEFAULT_VALUE = (): FilterOperator[] => ['eq'];

interface XFilterOperatorsCardProps {
  pointer: JsonPointer;
}

/**
 * `x-filterOperators` lists the filter operators the runtime accepts for this
 * field, in runtime spelling (`eq neq gt gte lt lte between contains startsWith
 * endsWith in nin includes isNull`). Legacy spellings (`ge`, `like`, …) are shown
 * as their runtime equivalent and rewritten only on the next user change; values
 * Forge does not know are kept verbatim.
 */
export function XFilterOperatorsCard({ pointer }: XFilterOperatorsCardProps) {
  const readOnly = useFormReadOnly();
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-filterOperators', DEFAULT_VALUE);
  const { known, unknown: preserved, legacy } = splitOperators(node?.['x-filterOperators']);
  const selected = new Set<string>(known);

  function setOperator(op: FilterOperator, on: boolean): void {
    const next = new Set<string>(known);
    if (on) next.add(op);
    else next.delete(op);
    updateComponent(setKeyword(pointer, 'x-filterOperators', mergeOperators(next, preserved)));
  }

  return (
    <VNextCardShell
      xKey="x-filterOperators"
      title="Filter operators"
      purpose="Operators the runtime accepts when instances are filtered by this field. Turn off the card to remove all operators (field becomes unfilterable)."
      enabled={enabled}
      onToggle={toggle}>
      <div className="space-y-2">
        {FILTER_OPERATOR_CATEGORIES.map((category) => {
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
      {legacy.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Shown with runtime names:{' '}
          <span className="font-mono">{legacy.map((l) => `${l.raw} → ${l.normalized}`).join(', ')}</span>.
          They are saved with these names on your next change.
        </p>
      )}
      {preserved.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Also kept: <span className="font-mono">{preserved.join(', ')}</span>
        </p>
      )}
    </VNextCardShell>
  );
}
