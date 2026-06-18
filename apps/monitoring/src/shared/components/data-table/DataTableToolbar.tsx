import { useState } from 'react'
import { ChevronDown, ChevronUp, PlusCircle, Settings2 } from 'lucide-react'
import type { Table } from '@tanstack/react-table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Checkbox,
} from '@vnext-forge-studio/designer-ui/ui'
import { FilterBuilderPanel } from './DataTableAdvancedFilter'
import { createCondition, createEmptyFilterRoot, countConditions } from './filter-eval'
import type { FilterGroup, FilterableColumn } from './types'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  toolbarContent?: React.ReactNode
  filterableColumns?: FilterableColumn[]
  filterRoot?: FilterGroup
  onFilterRootChange?: (root: FilterGroup) => void
}

export function DataTableToolbar<TData>({
  table,
  toolbarContent,
  filterableColumns,
  filterRoot,
  onFilterRootChange,
}: DataTableToolbarProps<TData>) {
  const [panelOpen, setPanelOpen] = useState(false)
  const hidableColumns = table.getAllColumns().filter((col) => col.getCanHide())
  const hasFilterableColumns = (filterableColumns?.length ?? 0) > 0
  const activeConditionCount = filterRoot ? countConditions(filterRoot) : 0
  const hasActiveFilters = activeConditionCount > 0

  function handleAddFilter() {
    setPanelOpen(true)
    // Seed one empty condition when the panel has no children yet.
    if (!filterRoot?.children.length && filterableColumns?.[0] && onFilterRootChange) {
      const root = filterRoot ?? createEmptyFilterRoot()
      onFilterRootChange({ ...root, children: [createCondition(filterableColumns[0])] })
    }
  }

  function handleClear() {
    setPanelOpen(false)
    onFilterRootChange?.(createEmptyFilterRoot())
  }

  const showPanel = hasFilterableColumns && panelOpen

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      {/* Row 1: search + filter toggle (left) | Columns (right) */}
      <div className="flex items-center gap-2">
        {toolbarContent && (
          <div className="flex flex-wrap items-center gap-2">{toolbarContent}</div>
        )}

        {hasFilterableColumns && (
          panelOpen ? (
            // Collapse panel — keeps active filters intact
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/10"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {activeConditionCount}
                </span>
              )}
            </button>
          ) : (
            // Open / re-open panel
            <button
              type="button"
              onClick={handleAddFilter}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {hasActiveFilters ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Filters
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                    {activeConditionCount}
                  </span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add Filter
                </>
              )}
            </button>
          )
        )}

        <div className="flex-1" />

        {hidableColumns.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Columns
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Toggle columns
              </p>
              <div className="flex flex-col gap-2">
                {hidableColumns.map((col) => {
                  const headerText =
                    typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                  return (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={col.getIsVisible()}
                        onCheckedChange={(checked) => col.toggleVisibility(!!checked)}
                      />
                      <span className="text-sm text-foreground">{headerText}</span>
                    </label>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Row 2: filter builder panel (only when open) */}
      {showPanel && (
        <FilterBuilderPanel
          root={filterRoot ?? createEmptyFilterRoot()}
          filterableColumns={filterableColumns ?? []}
          onChange={(next) => onFilterRootChange?.(next)}
          onClear={handleClear}
        />
      )}
    </div>
  )
}
