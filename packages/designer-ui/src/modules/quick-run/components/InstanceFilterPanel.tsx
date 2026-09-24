import { useCallback, useId, useMemo, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../ui/Tooltip';
import {
  ALL_OPERATORS,
  INSTANCE_FIELDS,
  INSTANCE_TYPE_OPTIONS,
  STATUS_OPTIONS,
  getFieldType,
  isValidAttributePath,
  operatorNeedsValue,
  resolveValueType,
  serializeInstanceFilter,
  serializeInstanceSort,
  sortableInstanceFields,
  type FilterCondition,
  type FilterOperator,
  type FilterValueType,
} from '../utils/instanceFilterSerializer';
import {
  describeSchemaField,
  fieldValueType,
  findSchemaField,
  isRuntimeSafeFieldPath,
  operatorsForCondition,
  schemaFieldNotice,
  sortableAttributeOptions,
  usesIndexProjection,
  type MasterSchemaField,
} from '../utils/masterSchemaFields';

const DEFAULT_ORDER_BY = serializeInstanceSort('createdAt', 'desc');

const VALUE_TYPES: { value: FilterValueType; label: string }[] = [
  { value: 'text', label: 'text' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'bool' },
  { value: 'date', label: 'date' },
];

const INPUT_CLASS =
  'rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-1 py-0.5 text-[10px] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]';

const IDX_BADGE_CLASS =
  'shrink-0 rounded bg-[var(--vscode-testing-iconPassed)] px-1 py-0.5 text-[8px] font-semibold text-[var(--vscode-editor-background)]';

export interface InstanceFilterPanelProps {
  onApply: (filter?: string, orderBy?: string, sort?: string) => void;
  onClose: () => void;
  /** Fields of the workflow's local master schema; `undefined` when none was loaded. */
  schemaFields?: readonly MasterSchemaField[];
  /** Key of that master schema, shown as the suggestion source. */
  schemaKey?: string;
}

export function InstanceFilterPanel({ onApply, onClose, schemaFields, schemaKey }: InstanceFilterPanelProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [attrInput, setAttrInput] = useState('');
  // Row index → message, populated on Apply (and cleared as rows change) so a
  // half-typed row is not shouted at while the author is still editing.
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const attrListId = useId();
  const attributeSortOptions = useMemo(() => sortableAttributeOptions(schemaFields), [schemaFields]);
  // Only offer paths the runtime's ValidateFieldName would accept (letters/digits/
  // underscores per dotted segment, starting with a letter) — anything else is
  // rejected outright, so suggesting it just sets the user up for a 400.
  const datalistFields = useMemo(
    () => (schemaFields ?? []).filter((f) => isRuntimeSafeFieldPath(f.path)),
    [schemaFields],
  );

  const attrInputValid = attrInput.trim() === '' || isValidAttributePath(attrInput);

  const addInstanceCondition = useCallback(() => {
    setRowErrors({});
    setFilterError(null);
    setConditions((prev) => [
      ...prev,
      { category: 'instance', field: 'status', operator: 'eq', value: '' },
    ]);
  }, []);

  const addAttributeCondition = useCallback(
    (fieldName: string) => {
      const name = fieldName.trim();
      if (!name || !isValidAttributePath(name)) return;
      setRowErrors({});
      setFilterError(null);
      const field = findSchemaField(schemaFields, name);
      const draft: FilterCondition = {
        category: 'attribute',
        field: name,
        operator: 'eq',
        value: '',
        valueType: field ? fieldValueType(field) : 'text',
      };
      const operator = operatorsForCondition(draft, schemaFields)[0] ?? 'eq';
      setConditions((prev) => [...prev, { ...draft, operator }]);
    },
    [schemaFields],
  );

  const removeCondition = useCallback((index: number) => {
    setRowErrors({});
    setFilterError(null);
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCondition = useCallback(
    (index: number, patch: Partial<FilterCondition>) => {
      setFilterError(null);
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
            const ops = operatorsForCondition(updated, schemaFields);
            if (!ops.includes(updated.operator)) updated.operator = ops[0] ?? 'eq';
          }
          if (patch.operator !== undefined && patch.operator !== 'between') updated.value2 = undefined;
          return updated;
        }),
      );
    },
    [schemaFields],
  );

  const handleApply = useCallback(() => {
    const result = serializeInstanceFilter(conditions);
    if (Object.keys(result.errors).length > 0) {
      setRowErrors(result.errors);
      return;
    }
    if (result.filterError) {
      setFilterError(result.filterError);
      return;
    }
    setRowErrors({});
    setFilterError(null);
    onApply(result.filter, serializeInstanceSort(sortField, sortDirection), undefined);
  }, [conditions, sortField, sortDirection, onApply]);

  const handleClear = useCallback(() => {
    setConditions([]);
    setRowErrors({});
    setFilterError(null);
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

      {schemaKey && (
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
          Attribute suggestions from master schema <span className="font-mono">{schemaKey}</span>
        </span>
      )}

      {conditions.map((c, i) => (
        <FilterRow
          key={i}
          condition={c}
          error={rowErrors[i]}
          schemaFields={schemaFields}
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
              list={schemaFields ? attrListId : undefined}
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
            {schemaFields && (
              <datalist id={attrListId}>
                {datalistFields.map((f) => (
                  <option key={f.path} value={f.path} label={describeSchemaField(f)} />
                ))}
              </datalist>
            )}
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
          <optgroup label="Instance">
            {sortableInstanceFields().map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </optgroup>
          {attributeSortOptions.length > 0 && (
            <optgroup label="Attributes (x-sortable)">
              {attributeSortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.indexed ? `${o.label} · IDX` : o.label}</option>
              ))}
            </optgroup>
          )}
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
      <div className="flex flex-wrap items-center gap-1">
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
        {filterError && (
          <span className="text-[10px] text-[var(--vscode-errorForeground)]" role="alert">
            {filterError}
          </span>
        )}
      </div>
    </div>
  );
}

export interface FilterRowProps {
  condition: FilterCondition;
  error?: string;
  schemaFields?: readonly MasterSchemaField[];
  onChange: (patch: Partial<FilterCondition>) => void;
  onRemove: () => void;
}

export function FilterRow({ condition, error, schemaFields, onChange, onRemove }: FilterRowProps) {
  const fieldType = getFieldType(condition.category, condition.field);
  const operators = operatorsForCondition(condition, schemaFields);
  const valueType = resolveValueType(condition);
  const isAttribute = condition.category === 'attribute';
  const schemaField = isAttribute ? findSchemaField(schemaFields, condition.field.trim()) : undefined;
  const notice = schemaFieldNotice(condition, schemaFields);

  const enumOptions: readonly string[] | null =
    fieldType === 'status' ? STATUS_OPTIONS : fieldType === 'instanceType' ? INSTANCE_TYPE_OPTIONS : null;
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
  const idxTitle = usesIndexProjection(condition.operator, schemaField)
    ? 'Indexed field (x-indexed). This operator reads the index column once the generated index SQL has been run.'
    : 'Indexed field (x-indexed). This operator uses JSON containment, not the index column.';

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
            {schemaField?.indexed && (
              <span className={IDX_BADGE_CLASS} title={idxTitle}>
                IDX
              </span>
            )}
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
        ) : enumOptions && (condition.operator === 'eq' || condition.operator === 'ne') ? (
          <select
            className={`flex-1 ${INPUT_CLASS} ${errorClass}`}
            value={condition.value}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">Select...</option>
            {enumOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : enumOptions ? (
          <input
            type="text"
            className={`flex-1 ${INPUT_CLASS} ${errorClass}`}
            value={condition.value}
            placeholder={enumOptions.slice(0, 2).join(', ')}
            title="Comma-separated names"
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
      {notice && (
        <span className="pl-1 text-[10px] text-[var(--vscode-editorWarning-foreground)]">{notice}</span>
      )}
    </div>
  );
}
