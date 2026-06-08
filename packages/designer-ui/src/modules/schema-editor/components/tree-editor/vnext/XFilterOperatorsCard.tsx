import { Checkbox } from '../../../../../ui/Checkbox';
import { type JsonPointer } from '../../../model/jsonPointer';
import { setKeyword } from '../../../model/mutators';
import { useSchemaEditorStore } from '../../../useSchemaEditorStore';
import { useSchemaNode } from '../../../hooks/useSchemaNode';
import { useVNextEnabled } from '../../../hooks/useVNextEnabled';
import { VNextCardShell } from './VNextCardShell';

/**
 * Vocab enum (mirrors `view-vocab.json#x-filterOperators.items.enum`).
 * Grouped by category for the picker UI only — persisted strings are
 * the bare enum values.
 *
 * Type / operator compatibility is enforced by the server (e.g.
 * `string + gt/lt/ge/le/between` → date compare; `boolean` → equality
 * only). The editor lists every operator; authors pick the subset
 * that applies to their field's type.
 */
const FILTER_OPERATORS = [
  { value: 'eq', category: 'Equality' },
  { value: 'ne', category: 'Equality' },
  { value: 'gt', category: 'Comparison' },
  { value: 'ge', category: 'Comparison' },
  { value: 'lt', category: 'Comparison' },
  { value: 'le', category: 'Comparison' },
  { value: 'between', category: 'Comparison' },
  { value: 'match', category: 'Text' },
  { value: 'like', category: 'Text' },
  { value: 'startswith', category: 'Text' },
  { value: 'endswith', category: 'Text' },
  { value: 'in', category: 'Membership' },
  { value: 'nin', category: 'Membership' },
] as const;

type FilterOperator = (typeof FILTER_OPERATORS)[number]['value'];

const FILTER_OPERATOR_SET: ReadonlySet<string> = new Set(
  FILTER_OPERATORS.map((o) => o.value),
);

const CATEGORIES = ['Equality', 'Comparison', 'Text', 'Membership'] as const;

// Seed with the most common operator so the toggle-on state is
// immediately valid (vocab allows empty array but it's semantically
// equivalent to "not filterable" → users should toggle the whole
// card off in that case).
const DEFAULT_VALUE = (): FilterOperator[] => ['eq'];

interface XFilterOperatorsCardProps {
  pointer: JsonPointer;
}

function normalizeOperators(value: unknown): FilterOperator[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: FilterOperator[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    if (!FILTER_OPERATOR_SET.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as FilterOperator);
  }
  return out;
}

/**
 * `x-filterOperators` lists the filter operators a tabular consumer
 * may apply to this field. Persisted shape: an array of strings drawn
 * from `eq | ne | gt | ge | lt | le | between | match | like |
 * startswith | endswith | in | nin`. Empty or absent → field is not
 * filterable.
 */
export function XFilterOperatorsCard({ pointer }: XFilterOperatorsCardProps) {
  const { node } = useSchemaNode(pointer);
  const updateComponent = useSchemaEditorStore((s) => s.updateComponent);
  const { enabled, toggle } = useVNextEnabled(pointer, 'x-filterOperators', DEFAULT_VALUE);
  const value = normalizeOperators(node?.['x-filterOperators']);
  const selected = new Set(value);

  function setOperator(op: FilterOperator, on: boolean): void {
    const next = new Set(value);
    if (on) next.add(op);
    else next.delete(op);
    // Preserve the canonical operator ordering from FILTER_OPERATORS
    // so the persisted array stays deterministic regardless of click
    // order.
    const ordered = FILTER_OPERATORS.filter((o) => next.has(o.value)).map((o) => o.value);
    updateComponent(setKeyword(pointer, 'x-filterOperators', ordered));
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
                      className="flex cursor-pointer items-center gap-1 rounded-md border border-primary-border/60 bg-primary-muted/30 px-2 py-1 text-[10px] font-mono hover:bg-primary-muted/60">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(next) => setOperator(op.value, next === true)}
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
    </VNextCardShell>
  );
}
