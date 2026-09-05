import { useCallback, useMemo, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';
import {
  ALL_OPERATORS,
  INSTANCE_FIELDS,
  STATUS_OPTIONS,
  getFieldType,
  getOperatorsForFieldType,
  isValidAttributePath,
  operatorNeedsValue,
  resolveValueType,
  serializeInstanceFilter,
  serializeInstanceSort,
  type FilterCondition,
  type FilterOperator,
  type FilterValueType,
} from '../utils/instanceFilterSerializer';

const DEFAULT_ORDER_BY = serializeInstanceSort('createdAt', 'desc');

const VALUE_TYPES: { value: FilterValueType; label: string }[] = [
  { value: 'text', label: 'text' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'bool' },
  { value: 'date', label: 'date' },
];

const INPUT_CLASS =
  'rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]';

interface InstanceFilterPanelProps {
  onApply: (filter?: string, orderBy?: string, sort?: string) => void;
  onClose: () => void;
}

export function InstanceFilterPanel({ onApply, onClose }: InstanceFilterPanelProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [attrInput, setAttrInput] = useState('');
  // Row index → message, populated on Apply (and cleared as rows change) so a
  // half-typed row is not shouted at while the author is still editing.
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const attrInputValid = attrInput.trim() === '' || isValidAttributePath(attrInput);

  const addInstanceCondition = useCallback(() => {
    setRowErrors({});
    setConditions((prev) => [
      ...prev,
      { category: 'instance', field: 'status', operator: 'eq', value: '' },
    ]);
  }, []);

  const addAttributeCondition = useCallback((fieldName: string) => {
    const name = fieldName.trim();
    if (!name || !isValidAttributePath(name)) return;
    setRowErrors({});
    setConditions((prev) => [
      ...prev,
      { category: 'attribute', field: name, operator: 'eq', value: '', valueType: 'text' },
    ]);
  }, []);

  const removeCondition = useCallback((index: number) => {
    setRowErrors({});
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCondition = useCallback((index: number, patch: Partial<FilterCondition>) => {
    setRowErrors((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setConditions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const updated: FilterCondition = { ...c, ...patch };
        if (patch.field !== undefined || patch.category !== undefined || patch.valueType !== undefined) {
          const ops = getOperatorsForFieldType(getFieldType(updated.category, updated.field), updated.valueType);
          if (!ops.includes(updated.operator)) updated.operator = ops[0];
        }
        if (patch.operator !== undefined && patch.operator !== 'between') updated.value2 = undefined;
        return updated;
      }),
    );
  }, []);

  const handleApply = useCallback(() => {
    const result = serializeInstanceFilter(conditions);
    if (Object.keys(result.errors).length > 0) {
      setRowErrors(result.errors);
      return;
    }
    setRowErrors({});
    onApply(result.filter, serializeInstanceSort(sortField, sortDirection), undefined);
  }, [conditions, sortField, sortDirection, onApply]);

  const handleClear = useCallback(() => {
    setConditions([]);
    setRowErrors({});
    setSortField('createdAt');
    setSortDirection('desc');
    onApply(undefined, DEFAULT_ORDER_BY, undefined);
  }, [onApply]);

  const hasErrors = useMemo(() => Object.keys(rowErrors).length > 0, [rowErrors]);

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
          error={rowErrors[i]}
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
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <input
              type="text"
              className={`w-28 ${INPUT_CLASS} ${attrInputValid ? '' : 'border-[var(--vscode-inputValidation-errorBorder)]'}`}
              placeholder="attribute path"
              title="Instance data path, e.g. amount or customer.id (letters, digits, underscores)"
              aria-invalid={!attrInputValid}
              value={attrInput}
              onChange={(e) => setAttrInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && attrInput.trim() && attrInputValid) {
                  addAttributeCondition(attrInput);
                  setAttrInput('');
                }
              }}
            />
            <button
              className="rounded bg-[var(--vscode-button-secondaryBackground)] px-1.5 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] disabled:opacity-40"
              disabled={!attrInput.trim() || !attrInputValid}
              onClick={() => {
                addAttributeCondition(attrInput);
                setAttrInput('');
              }}
            >
              + Attr
            </button>
          </div>
          {!attrInputValid && (
            <span className="text-[10px] text-[var(--vscode-errorForeground)]">
              Use letters, digits and underscores; separate nested fields with dots.
            </span>
          )}
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1 border-t border-[var(--vscode-panel-border)] pt-2">
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">Sort:</span>
        <select
          className={`flex-1 ${INPUT_CLASS}`}
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
          className="rounded bg-[var(--vscode-button-background)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-40"
          onClick={handleApply}
          disabled={hasErrors}
          title={hasErrors ? 'Fix the highlighted conditions first' : undefined}
        >
          Apply
        </button>
        <button
          className="rounded border border-[var(--vscode-panel-border)] px-2 py-0.5 text-[10px] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={handleClear}
        >
          Clear
        </button>
        {hasErrors && (
          <span className="text-[10px] text-[var(--vscode-errorForeground)]">
            Some conditions are invalid.
          </span>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  condition,
  error,
  onChange,
  onRemove,
}: {
  condition: FilterCondition;
  error?: string;
  onChange: (patch: Partial<FilterCondition>) => void;
  onRemove: () => void;
}) {
  const fieldType = getFieldType(condition.category, condition.field);
  const operators = getOperatorsForFieldType(fieldType, condition.valueType);
  const valueType = resolveValueType(condition);

  const isStatus = fieldType === 'status';
  const isAttribute = condition.category === 'attribute';
  const needsValue = operatorNeedsValue(condition.operator);
  const isBetween = condition.operator === 'between';
  const isList = condition.operator === 'in' || condition.operator === 'nin';
  const isIncludes = condition.operator === 'includes';
  const errorClass = error ? 'border-[var(--vscode-inputValidation-errorBorder)]' : '';

  const valueInputType = valueType === 'date' ? 'datetime-local' : valueType === 'number' && !isList ? 'number' : 'text';
  const placeholder = isList
    ? valueType === 'number' ? '1, 2, 3' : 'a, b, c'
    : isIncludes
      ? '{"role":"admin"}'
      : valueType === 'boolean'
        ? 'true / false'
        : isBetween ? 'from' : 'value';

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        {condition.category === 'instance' ? (
          <select
            className={`w-24 ${INPUT_CLASS}`}
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
              className={`min-w-0 flex-1 ${INPUT_CLASS} ${errorClass}`}
              value={condition.field}
              onChange={(e) => onChange({ field: e.target.value })}
            />
          </div>
        )}

        {isAttribute && (
          <select
            className={`w-14 ${INPUT_CLASS}`}
            value={condition.valueType ?? 'text'}
            title="Value type — decides how the value is sent (string, number, boolean, ISO date)"
            aria-label="Value type"
            onChange={(e) => onChange({ valueType: e.target.value as FilterValueType })}
          >
            {VALUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}

        <select
          className={`w-[70px] ${INPUT_CLASS}`}
          value={condition.operator}
          onChange={(e) => onChange({ operator: e.target.value as FilterOperator })}
        >
          {operators.map((op) => {
            const def = ALL_OPERATORS.find((o) => o.value === op);
            return <option key={op} value={op}>{def?.label ?? op}</option>;
          })}
        </select>

        {!needsValue ? (
          <span className="flex-1 px-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
            (no value needed)
          </span>
        ) : isStatus && (condition.operator === 'eq' || condition.operator === 'ne') ? (
          <select
            className={`flex-1 ${INPUT_CLASS} ${errorClass}`}
            value={condition.value}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">Select...</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : isStatus ? (
          <input
            type="text"
            className={`flex-1 ${INPUT_CLASS} ${errorClass}`}
            value={condition.value}
            placeholder="Active, Faulted"
            title="Comma-separated status names"
            onChange={(e) => onChange({ value: e.target.value })}
          />
        ) : (
          <>
            <input
              type={valueInputType}
              className={`min-w-0 flex-1 ${INPUT_CLASS} ${errorClass}`}
              value={condition.value}
              placeholder={placeholder}
              title={isList ? 'Comma-separated values' : undefined}
              onChange={(e) => onChange({ value: e.target.value })}
            />
            {isBetween && (
              <input
                type={valueInputType}
                className={`min-w-0 flex-1 ${INPUT_CLASS} ${errorClass}`}
                value={condition.value2 ?? ''}
                placeholder="to"
                aria-label="Upper bound"
                onChange={(e) => onChange({ value2: e.target.value })}
              />
            )}
          </>
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
      {error && (
        <span className="pl-1 text-[10px] text-[var(--vscode-errorForeground)]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
