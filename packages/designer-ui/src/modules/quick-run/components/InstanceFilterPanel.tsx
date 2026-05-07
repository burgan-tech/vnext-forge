import { useCallback, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';

type FilterOperator =
  | 'eq' | 'ne'
  | 'gt' | 'ge' | 'lt' | 'le'
  | 'between'
  | 'like' | 'startswith' | 'endswith'
  | 'in' | 'nin'
  | 'isNull';

type FieldCategory = 'instance' | 'attribute';

interface FilterCondition {
  category: FieldCategory;
  field: string;
  operator: FilterOperator;
  value: string;
}

const INSTANCE_FIELDS: { value: string; label: string; type: 'string' | 'status' | 'date' }[] = [
  { value: 'status', label: 'Status', type: 'status' },
  { value: 'currentState', label: 'Current State', type: 'string' },
  { value: 'key', label: 'Key', type: 'string' },
  { value: 'createdAt', label: 'Created At', type: 'date' },
  { value: 'modifiedAt', label: 'Modified At', type: 'date' },
  { value: 'completedAt', label: 'Completed At', type: 'date' },
];

const STATUS_OPTIONS = ['Active', 'Busy', 'Completed', 'Faulted'] as const;

const ALL_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'ge', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'le', label: '≤' },
  { value: 'between', label: 'between' },
  { value: 'like', label: 'contains' },
  { value: 'startswith', label: 'starts with' },
  { value: 'endswith', label: 'ends with' },
  { value: 'in', label: 'in list' },
  { value: 'nin', label: 'not in list' },
  { value: 'isNull', label: 'is null' },
];

function getFieldType(category: FieldCategory, field: string): 'string' | 'status' | 'date' | 'attribute' {
  if (category === 'attribute') return 'attribute';
  const def = INSTANCE_FIELDS.find((f) => f.value === field);
  return def?.type ?? 'string';
}

function getOperatorsForFieldType(type: string): FilterOperator[] {
  switch (type) {
    case 'status': return ['eq', 'ne', 'in', 'nin'];
    case 'date': return ['eq', 'gt', 'ge', 'lt', 'le', 'between'];
    case 'string': return ['eq', 'ne', 'like', 'startswith', 'endswith', 'in', 'nin', 'isNull'];
    case 'attribute': return ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'between', 'like', 'startswith', 'endswith', 'in', 'nin', 'isNull'];
    default: return ['eq', 'ne'];
  }
}

const DEFAULT_ORDER_BY = JSON.stringify({ field: 'createdAt', direction: 'desc' });

interface InstanceFilterPanelProps {
  onApply: (filter?: string, orderBy?: string, sort?: string) => void;
  onClose: () => void;
}

export function InstanceFilterPanel({ onApply, onClose }: InstanceFilterPanelProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [attrInput, setAttrInput] = useState('');

  const addInstanceCondition = useCallback(() => {
    setConditions((prev) => [
      ...prev,
      { category: 'instance', field: 'status', operator: 'eq', value: '' },
    ]);
  }, []);

  const addAttributeCondition = useCallback((fieldName: string) => {
    if (!fieldName.trim()) return;
    setConditions((prev) => [
      ...prev,
      { category: 'attribute', field: fieldName.trim(), operator: 'eq', value: '' },
    ]);
  }, []);

  const removeCondition = useCallback((index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCondition = useCallback((index: number, patch: Partial<FilterCondition>) => {
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, ...patch };
        if (patch.field !== undefined || patch.category !== undefined) {
          const type = getFieldType(updated.category, updated.field);
          const ops = getOperatorsForFieldType(type);
          if (!ops.includes(updated.operator)) {
            updated.operator = ops[0];
          }
        }
        return updated;
      }),
    );
  }, []);

  const handleApply = useCallback(() => {
    const validConditions = conditions.filter((c) =>
      c.operator === 'isNull' || c.value.trim() !== '',
    );

    let filterStr: string | undefined;
    if (validConditions.length > 0) {
      const parts = validConditions.map((c) => {
        const filterValue = c.operator === 'isNull' ? true : c.value;
        if (c.category === 'attribute') {
          return { attributes: { [c.field]: { [c.operator]: filterValue } } };
        }
        return { [c.field]: { [c.operator]: filterValue } };
      });
      filterStr = parts.length === 1
        ? JSON.stringify(parts[0])
        : JSON.stringify({ and: parts });
    }

    const orderBy = JSON.stringify({ field: sortField, direction: sortDirection });
    onApply(filterStr, orderBy, undefined);
  }, [conditions, sortField, sortDirection, onApply]);

  const handleClear = useCallback(() => {
    setConditions([]);
    setSortField('createdAt');
    setSortDirection('desc');
    onApply(undefined, DEFAULT_ORDER_BY, undefined);
  }, [onApply]);

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-2 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
          Filter & Sort
        </span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-[10px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                onClick={onClose}
                aria-label="Close filter panel"
              >
                ✕
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">
              Close
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {conditions.map((c, i) => (
        <FilterRow
          key={i}
          condition={c}
          onChange={(patch) => updateCondition(i, patch)}
          onRemove={() => removeCondition(i)}
        />
      ))}

      {/* Add filter controls */}
      <div className="flex items-center gap-2">
        <button
          className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={addInstanceCondition}
        >
          + Instance field
        </button>
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">|</span>
        <div className="flex items-center gap-1">
          <input
            type="text"
            className="w-24 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            placeholder="attributes.field"
            value={attrInput}
            onChange={(e) => setAttrInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && attrInput.trim()) {
                addAttributeCondition(attrInput);
                setAttrInput('');
              }
            }}
          />
          <button
            className="rounded bg-[var(--vscode-button-secondaryBackground)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-40"
            disabled={!attrInput.trim()}
            onClick={() => {
              addAttributeCondition(attrInput);
              setAttrInput('');
            }}
          >
            + Attr
          </button>
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1 border-t border-[var(--vscode-panel-border)] pt-2">
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">Sort:</span>
        <select
          className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)]"
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
        >
          {INSTANCE_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button
          className="rounded border border-[var(--vscode-input-border)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
          title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
        >
          {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          className="rounded bg-[var(--vscode-button-background)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
          onClick={handleApply}
        >
          Apply
        </button>
        <button
          className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function FilterRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  onChange: (patch: Partial<FilterCondition>) => void;
  onRemove: () => void;
}) {
  const fieldType = getFieldType(condition.category, condition.field);
  const operators = getOperatorsForFieldType(fieldType);

  const isDate = fieldType === 'date';
  const isStatus = fieldType === 'status';
  const isIsNull = condition.operator === 'isNull';

  return (
    <div className="flex items-center gap-1">
      {condition.category === 'instance' ? (
        <select
          className="w-24 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)]"
          value={condition.field}
          onChange={(e) => onChange({ field: e.target.value })}
        >
          {INSTANCE_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      ) : (
        <div className="flex w-24 items-center gap-0.5">
          <span className="shrink-0 rounded bg-[var(--vscode-badge-background)] px-1 py-0.5 text-[8px] text-[var(--vscode-badge-foreground)]">
            attr
          </span>
          <input
            type="text"
            className="min-w-0 flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)]"
            value={condition.field}
            onChange={(e) => onChange({ field: e.target.value })}
          />
        </div>
      )}

      <select
        className="w-[70px] rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-0.5 py-0.5 text-[10px] text-[var(--vscode-input-foreground)]"
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value as FilterOperator })}
      >
        {operators.map((op) => {
          const def = ALL_OPERATORS.find((o) => o.value === op);
          return <option key={op} value={op}>{def?.label ?? op}</option>;
        })}
      </select>

      {isIsNull ? (
        <span className="flex-1 px-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
          (no value needed)
        </span>
      ) : isStatus && (condition.operator === 'eq' || condition.operator === 'ne') ? (
        <select
          className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)]"
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          <option value="">Select...</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : isStatus && (condition.operator === 'in' || condition.operator === 'nin') ? (
        <input
          type="text"
          className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
          value={condition.value}
          placeholder="Active,Faulted"
          onChange={(e) => onChange({ value: e.target.value })}
        />
      ) : isDate ? (
        <input
          type="datetime-local"
          className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)]"
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      ) : (
        <input
          type="text"
          className="flex-1 rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
          value={condition.value}
          placeholder={condition.operator === 'between' ? 'min,max' : 'value'}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="shrink-0 text-[var(--vscode-errorForeground)] hover:text-[var(--vscode-foreground)]"
              onClick={onRemove}
              aria-label="Remove"
            >
              ✕
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-[11px]">
            Remove
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
