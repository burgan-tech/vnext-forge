import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@monitoring/shared/lib/utils'
import { useColumnVisibility } from './useColumnVisibility'
import { DataTableToolbar } from './DataTableToolbar'
import { DataTablePagination } from './DataTablePagination'
import type {
  DataTablePaginationState,
  FilterableColumn,
  FilterGroup,
  QueryParamFilters,
} from './types'

interface DataTableProps<TData> {
  tableId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  data: TData[]
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  emptyMessage?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSortChange?: (col: string | null, dir: 'asc' | 'desc' | null) => void
  pagination: DataTablePaginationState
  onRowClick?: (row: TData) => void
  toolbarContent?: React.ReactNode
  filterableColumns?: FilterableColumn[]
  /** Determines which filter UI to render. Defaults to 'graphql' (nested AND/OR tree). */
  filterMode?: 'graphql' | 'query-param'
  // graphql mode
  filterRoot?: FilterGroup
  onFilterRootChange?: (root: FilterGroup) => void
  // query-param mode
  queryParamFilters?: QueryParamFilters
  onQueryParamFiltersChange?: (filters: QueryParamFilters) => void
}

function getNextSortDir(
  colId: string,
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc' | undefined,
): 'asc' | 'desc' | null {
  if (sortBy !== colId) return 'asc'
  if (sortDir === 'asc') return 'desc'
  return null
}

export function DataTable<TData>({
  tableId,
  columns,
  data,
  isLoading = false,
  isError = false,
  errorMessage = 'Failed to load data.',
  emptyMessage = 'No results found.',
  sortBy,
  sortDir,
  onSortChange,
  pagination,
  onRowClick,
  toolbarContent,
  filterableColumns,
  filterMode,
  filterRoot,
  onFilterRootChange,
  queryParamFilters,
  onQueryParamFiltersChange,
}: DataTableProps<TData>) {
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(tableId)

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  })

  const visibleColumnCount = table.getVisibleLeafColumns().length

  return (
    <div className="flex flex-col rounded-md border border-border">
      <DataTableToolbar
        table={table}
        toolbarContent={toolbarContent}
        filterableColumns={filterableColumns}
        filterMode={filterMode}
        filterRoot={filterRoot}
        onFilterRootChange={onFilterRootChange}
        queryParamFilters={queryParamFilters}
        onQueryParamFiltersChange={onQueryParamFiltersChange}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y border-border bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const isSorted = sortBy === header.column.id
                  const nextDir = getNextSortDir(header.column.id, sortBy, sortDir)

                  return (
                    <th
                      key={header.id}
                      onClick={() => {
                        if (!canSort || !onSortChange) return
                        onSortChange(nextDir ? header.column.id : null, nextDir)
                      }}
                      className={cn(
                        'group px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                        canSort && 'cursor-pointer select-none hover:text-foreground',
                        isSorted && 'text-foreground',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (isSorted && sortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3 shrink-0" />
                          ) : isSorted && sortDir === 'desc' ? (
                            <ArrowDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
                          ))}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && isError && (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="px-4 py-8 text-center text-sm text-destructive"
                >
                  {errorMessage}
                </td>
              </tr>
            )}
            {!isLoading && !isError && table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumnCount}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-muted/30',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <DataTablePagination pagination={pagination} />
    </div>
  )
}
