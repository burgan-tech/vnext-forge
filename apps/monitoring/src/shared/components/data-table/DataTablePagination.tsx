import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@monitoring/shared/lib/utils'
import type { DataTablePaginationState } from './types'

interface DataTablePaginationProps {
  pagination: DataTablePaginationState
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}

export function DataTablePagination({ pagination }: DataTablePaginationProps) {
  const { page, pageSize, hasNext, totalCount, onPageChange, onPageSizeChange } = pagination
  const pageSizeOptions = pagination.pageSizeOptions ?? [10, 25, 50]
  const totalPages =
    totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-2 py-2 text-sm">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <NavBtn onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavBtn>

        {totalPages != null ? (
          pageNumbers(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p as number)}
                className={cn(
                  'h-8 min-w-8 rounded-md px-2 text-xs transition-colors',
                  p === page
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm ring-2 ring-primary/25 ring-offset-1'
                    : 'border border-border bg-background font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
                )}
              >
                {p}
              </button>
            ),
          )
        ) : (
          <span className="px-2 text-xs text-muted-foreground">Page {page}</span>
        )}

        <NavBtn onClick={() => onPageChange(page + 1)} disabled={!hasNext} title="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </NavBtn>

        {totalCount != null && (
          <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} / {totalCount}
          </span>
        )}
      </div>

      {/* Page size */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Rows:</span>
        <div className="flex items-center gap-1">
          {pageSizeOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPageSizeChange(s)}
              className={cn(
                'h-8 min-w-8 rounded-md px-2.5 text-xs transition-colors',
                s === pageSize
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm ring-2 ring-primary/25 ring-offset-1'
                  : 'border border-border bg-background font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NavBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}
