import { useEffect, useState } from 'react'
import { Check, Plus, FolderPlus, X } from 'lucide-react'
import { cn } from '@monitoring/shared/lib/utils'
import { createCondition, createGroup, countConditions, operatorsFor } from './filter-eval'
import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOperator,
  FilterableColumn,
} from './types'

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'is',
  contains: 'contains',
  gt: 'after',
  lt: 'before',
}

const inputCls =
  'h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

// ---------------------------------------------------------------------------
// ConditionRow — column / operator / value on one line, updates draft only
// ---------------------------------------------------------------------------

interface ConditionRowProps {
  condition: FilterCondition
  filterableColumns: FilterableColumn[]
  onChange: (next: FilterCondition) => void
  onRemove: () => void
}

function ConditionRow({ condition, filterableColumns, onChange, onRemove }: ConditionRowProps) {
  const column = filterableColumns.find((c) => c.id === condition.columnId)
  const operators = column ? operatorsFor(column.type) : ['eq' as FilterOperator]

  function handleColumnChange(columnId: string) {
    const col = filterableColumns.find((c) => c.id === columnId)
    if (!col) return
    onChange({ ...createCondition(col), id: condition.id })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={condition.columnId}
        onChange={(e) => handleColumnChange(e.target.value)}
        className={inputCls}
      >
        {filterableColumns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.label}
          </option>
        ))}
      </select>

      {operators.length > 1 ? (
        <select
          value={condition.operator}
          onChange={(e) => onChange({ ...condition, operator: e.target.value as FilterOperator })}
          className={inputCls}
        >
          {operators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      ) : (
        <span className="px-1 text-xs font-medium text-muted-foreground">
          {OPERATOR_LABELS[operators[0]]}
        </span>
      )}

      {column?.type === 'select' ? (
        <select
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className={inputCls}
        >
          <option value="">Select…</option>
          {column.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : column?.type === 'date' ? (
        <input
          type="date"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className={inputCls}
        />
      ) : (
        <input
          type="text"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value…"
          className={cn(inputCls, 'w-36 placeholder:text-muted-foreground')}
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        title="Remove condition"
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CombinatorToggle — AND / OR switch for a group
// ---------------------------------------------------------------------------

function CombinatorToggle({
  value,
  onChange,
}: {
  value: FilterGroup['combinator']
  onChange: (next: FilterGroup['combinator']) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-border text-xs font-semibold">
      {(['and', 'or'] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            'px-2 py-0.5 uppercase transition-colors',
            value === c
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:text-foreground',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GroupBox — recursive group with combinator + children + add buttons
// ---------------------------------------------------------------------------

interface GroupBoxProps {
  group: FilterGroup
  filterableColumns: FilterableColumn[]
  onChange: (next: FilterGroup) => void
  onRemove?: () => void
  depth: number
  /** Rendered in the add-buttons row at depth 0 (right side). */
  applySlot?: React.ReactNode
}

function GroupBox({ group, filterableColumns, onChange, onRemove, depth, applySlot }: GroupBoxProps) {
  function replaceChild(index: number, next: FilterNode) {
    onChange({ ...group, children: group.children.map((c, i) => (i === index ? next : c)) })
  }

  function removeChild(index: number) {
    onChange({ ...group, children: group.children.filter((_, i) => i !== index) })
  }

  function addCondition() {
    const first = filterableColumns[0]
    if (!first) return
    onChange({ ...group, children: [...group.children, createCondition(first)] })
  }

  function addGroup() {
    onChange({ ...group, children: [...group.children, createGroup()] })
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border p-2',
        depth === 0 ? 'border-primary/20 bg-primary/5' : 'border-border bg-background',
      )}
    >
      <div className="flex items-center gap-2">
        <CombinatorToggle
          value={group.combinator}
          onChange={(combinator) => onChange({ ...group, combinator })}
        />
        <span className="text-[11px] text-muted-foreground">
          match {group.combinator === 'and' ? 'all' : 'any'} of
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove group"
            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {group.children.length > 0 && (
        <div className="flex flex-col gap-2 border-l border-border/70 pl-3">
          {group.children.map((child, index) =>
            child.kind === 'condition' ? (
              <ConditionRow
                key={child.id}
                condition={child}
                filterableColumns={filterableColumns}
                onChange={(next) => replaceChild(index, next)}
                onRemove={() => removeChild(index)}
              />
            ) : (
              <GroupBox
                key={child.id}
                group={child}
                filterableColumns={filterableColumns}
                onChange={(next) => replaceChild(index, next)}
                onRemove={() => removeChild(index)}
                depth={depth + 1}
              />
            ),
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addCondition}
          className="flex h-7 items-center gap-1 rounded border border-dashed border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Filter
        </button>
        <button
          type="button"
          onClick={addGroup}
          className="flex h-7 items-center gap-1 rounded border border-dashed border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <FolderPlus className="h-3 w-3" />
          Group
        </button>
        {applySlot && <div className="ml-auto">{applySlot}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FilterBuilderPanel — owns draft state; only pushes to parent on Apply
// ---------------------------------------------------------------------------

interface FilterBuilderPanelProps {
  root: FilterGroup
  filterableColumns: FilterableColumn[]
  onChange: (next: FilterGroup) => void
  onClear: () => void
}

export function FilterBuilderPanel({
  root,
  filterableColumns,
  onChange,
  onClear,
}: FilterBuilderPanelProps) {
  const [draftRoot, setDraftRoot] = useState<FilterGroup>(root)
  const [isDirty, setIsDirty] = useState(false)

  // Sync draft when parent resets (e.g. Clear all or type change)
  useEffect(() => {
    setDraftRoot(root)
    setIsDirty(false)
  }, [root])

  function handleDraftChange(next: FilterGroup) {
    setDraftRoot(next)
    setIsDirty(true)
  }

  function handleApply() {
    onChange(draftRoot)
    setIsDirty(false)
  }

  const appliedConditionCount = countConditions(root)
  const isApplied = !isDirty && appliedConditionCount > 0
  const canApply = isDirty

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear all
        </button>
      </div>

      {/* Group tree (edits draft only); Apply button lives in the add-buttons row */}
      <GroupBox
        group={draftRoot}
        filterableColumns={filterableColumns}
        onChange={handleDraftChange}
        depth={0}
        applySlot={
          <div className="flex items-center gap-2">
            {isApplied && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3 w-3 text-green-500" />
                Applied
              </span>
            )}
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors',
                canApply
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'cursor-not-allowed bg-muted text-muted-foreground',
              )}
            >
              Apply filters
            </button>
          </div>
        }
      />
    </div>
  )
}
