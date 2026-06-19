import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { cn } from '@monitoring/shared/lib/utils'
import type { FilterableColumn, QueryParamFilters } from './types'

// ---------------------------------------------------------------------------
// Draft row
// ---------------------------------------------------------------------------

interface FilterRow {
  id: string
  columnId: string
  /**
   * 'is'       — plain text column (no bracket), sends ?columnId=value
   * 'eq'       — text column with [eq] operator, sends ?columnId[eq]=value
   * 'contains' — text column with [contains] operator, sends ?columnId[contains]=value
   * '>'        — date column, sends ?columnId[gte]=value (ISO)
   * '<'        — date column, sends ?columnId[lte]=value (ISO)
   */
  operator: 'is' | 'eq' | 'contains' | '>' | '<'
  value: string
}

let _seq = 0
function rowId(): string {
  return `qpr${(_seq += 1)}`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultOperatorFor(col: FilterableColumn): FilterRow['operator'] {
  if (col.type === 'date') return '>'
  if (col.operators && col.operators.length > 0) return col.operators[0]
  return 'is'
}

// ---------------------------------------------------------------------------
// Date helpers — UI (YYYY-MM-DD) ↔ API (ISO 8601)
// ---------------------------------------------------------------------------

function toApiDate(operator: '>' | '<', raw: string): string {
  if (!raw) return raw
  return operator === '<' ? `${raw}T23:59:59Z` : `${raw}T00:00:00Z`
}

function fromApiDate(value: string): string {
  const tIdx = value.indexOf('T')
  return tIdx !== -1 ? value.slice(0, tIdx) : value
}

// ---------------------------------------------------------------------------
// Query param key ← draft row
// ---------------------------------------------------------------------------

function toParamKey(row: FilterRow): string {
  switch (row.operator) {
    case '>':        return `${row.columnId}[gte]`
    case '<':        return `${row.columnId}[lte]`
    case 'eq':       return `${row.columnId}[eq]`
    case 'contains': return `${row.columnId}[contains]`
    default:         return row.columnId           // plain 'is'
  }
}

function toParamValue(row: FilterRow): string {
  if (row.operator === '>') return toApiDate('>', row.value)
  if (row.operator === '<') return toApiDate('<', row.value)
  return row.value.trim()
}

// ---------------------------------------------------------------------------
// Applied filters → draft rows (reverse mapping)
// ---------------------------------------------------------------------------

function filtersToRows(filters: QueryParamFilters, columns: FilterableColumn[]): FilterRow[] {
  return Object.entries(filters)
    .filter(([, v]) => v !== '')
    .map(([key, value]) => {
      if (key.endsWith('[gte]')) {
        const base = key.slice(0, -5)
        const col = columns.find((c) => c.id === base && c.type === 'date')
        if (col) return { id: rowId(), columnId: col.id, operator: '>' as const, value: fromApiDate(value) }
      }
      if (key.endsWith('[lte]')) {
        const base = key.slice(0, -5)
        const col = columns.find((c) => c.id === base && c.type === 'date')
        if (col) return { id: rowId(), columnId: col.id, operator: '<' as const, value: fromApiDate(value) }
      }
      if (key.endsWith('[eq]')) {
        const base = key.slice(0, -4)
        const col = columns.find((c) => c.id === base && c.type === 'text')
        if (col) return { id: rowId(), columnId: col.id, operator: 'eq' as const, value }
      }
      if (key.endsWith('[contains]')) {
        const base = key.slice(0, -10)
        const col = columns.find((c) => c.id === base && c.type === 'text')
        if (col) return { id: rowId(), columnId: col.id, operator: 'contains' as const, value }
      }
      return { id: rowId(), columnId: key, operator: 'is' as const, value }
    })
}

// ---------------------------------------------------------------------------
// Slot tracking
// Date columns provide 2 slots (> and <); all others 1 slot.
// ---------------------------------------------------------------------------

function buildUsedKeys(draft: FilterRow[], columns: FilterableColumn[]): Set<string> {
  return new Set(
    draft.map((r) => {
      const col = columns.find((c) => c.id === r.columnId)
      return col?.type === 'date' ? `${r.columnId}:${r.operator}` : r.columnId
    }),
  )
}

function totalSlots(columns: FilterableColumn[]): number {
  return columns.reduce((sum, c) => sum + (c.type === 'date' ? 2 : 1), 0)
}

// ---------------------------------------------------------------------------
// QueryParamFilterPanel
// ---------------------------------------------------------------------------

interface QueryParamFilterPanelProps {
  filters: QueryParamFilters
  filterableColumns: FilterableColumn[]
  onChange: (filters: QueryParamFilters) => void
  onClear: () => void
}

export function QueryParamFilterPanel({
  filters,
  filterableColumns,
  onChange,
  onClear,
}: QueryParamFilterPanelProps) {
  const [draft, setDraft] = useState<FilterRow[]>(() => {
    const rows = filtersToRows(filters, filterableColumns)
    if (rows.length === 0 && filterableColumns.length > 0) {
      const first = filterableColumns[0]
      return [{ id: rowId(), columnId: first.id, operator: defaultOperatorFor(first), value: '' }]
    }
    return rows
  })
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setDraft(filtersToRows(filters, filterableColumns))
    setIsDirty(false)
    // filterableColumns is stable per component type — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  function handleDraftChange(rows: FilterRow[]) {
    setDraft(rows)
    setIsDirty(true)
  }

  function addRow() {
    const usedKeys = buildUsedKeys(draft, filterableColumns)
    for (const col of filterableColumns) {
      if (col.type === 'date') {
        if (!usedKeys.has(`${col.id}:>`)) {
          handleDraftChange([...draft, { id: rowId(), columnId: col.id, operator: '>', value: '' }])
          return
        }
        if (!usedKeys.has(`${col.id}:<`)) {
          handleDraftChange([...draft, { id: rowId(), columnId: col.id, operator: '<', value: '' }])
          return
        }
      } else if (!usedKeys.has(col.id)) {
        handleDraftChange([...draft, { id: rowId(), columnId: col.id, operator: defaultOperatorFor(col), value: '' }])
        return
      }
    }
  }

  function removeRow(id: string) {
    handleDraftChange(draft.filter((r) => r.id !== id))
  }

  function updateRow(id: string, changes: Partial<Omit<FilterRow, 'id'>>) {
    // When column changes, reset operator and value to defaults for the new column
    if ('columnId' in changes && changes.columnId !== undefined && !('operator' in changes)) {
      const newCol = filterableColumns.find((c) => c.id === changes.columnId)
      ;(changes as Partial<FilterRow>).operator = newCol ? defaultOperatorFor(newCol) : 'is'
      ;(changes as Partial<FilterRow>).value = ''
    }
    handleDraftChange(draft.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  }

  function handleApply() {
    const result: QueryParamFilters = {}
    for (const row of draft) {
      if (!row.value.trim()) continue
      result[toParamKey(row)] = toParamValue(row)
    }
    onChange(result)
    setIsDirty(false)
  }

  const appliedCount = Object.values(filters).filter(Boolean).length
  const isApplied = !isDirty && appliedCount > 0
  const canApply = isDirty
  const allSlotsUsed = draft.length >= totalSlots(filterableColumns)

  const inputCls =
    'h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="flex flex-col gap-2">
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

      <div className="flex flex-col gap-2 rounded-md border border-primary/20 bg-primary/5 p-2">
        {draft.length > 0 && (
          <div className="flex flex-col gap-2 border-l border-border/70 pl-3">
            {draft.map((row) => {
              const col = filterableColumns.find((c) => c.id === row.columnId)
              const isDate = col?.type === 'date'
              const colOps = col?.operators

              return (
                <div key={row.id} className="flex flex-wrap items-center gap-2">
                  {/* Column selector */}
                  <select
                    value={row.columnId}
                    onChange={(e) => updateRow(row.id, { columnId: e.target.value })}
                    className={inputCls}
                  >
                    {filterableColumns.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>

                  {/* Operator */}
                  {isDate ? (
                    <select
                      value={row.operator}
                      onChange={(e) =>
                        updateRow(row.id, { operator: e.target.value as '>' | '<', value: '' })
                      }
                      className={inputCls}
                    >
                      <option value=">">&gt; after</option>
                      <option value="<">&lt; before</option>
                    </select>
                  ) : colOps && colOps.length > 1 ? (
                    <select
                      value={row.operator}
                      onChange={(e) =>
                        updateRow(row.id, { operator: e.target.value as 'eq' | 'contains', value: '' })
                      }
                      className={inputCls}
                    >
                      <option value="eq">is</option>
                      <option value="contains">contains</option>
                    </select>
                  ) : (
                    <span className="px-1 text-xs font-medium text-muted-foreground">
                      {row.operator === 'contains' ? 'contains' : 'is'}
                    </span>
                  )}

                  {/* Value input */}
                  {col?.type === 'select' ? (
                    <select
                      value={row.value}
                      onChange={(e) => updateRow(row.id, { value: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Select…</option>
                      {col.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : col?.type === 'date' ? (
                    <input
                      type="date"
                      value={row.value}
                      onChange={(e) => updateRow(row.id, { value: e.target.value })}
                      className={inputCls}
                    />
                  ) : (
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => updateRow(row.id, { value: e.target.value })}
                      placeholder="Value…"
                      className={cn(inputCls, 'w-36 placeholder:text-muted-foreground')}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    title="Remove filter"
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            disabled={allSlotsUsed}
            className="flex h-7 items-center gap-1 rounded border border-dashed border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Filter
          </button>

          <div className="ml-auto flex items-center gap-2">
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
        </div>
      </div>
    </div>
  )
}
