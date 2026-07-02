import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@monitoring/shared/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = page * pageSize;

  const pages = pageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-sm">
      {/* Left: navigation */}
      <div className="flex items-center gap-1">
        {/* First */}
        <NavBtn onClick={() => onPageChange(1)} disabled={page <= 1} title="First page">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </NavBtn>
        {/* Prev */}
        <NavBtn onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavBtn>

        {/* Page number buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, i) =>
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
          )}
        </div>

        {/* Next */}
        <NavBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} title="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </NavBtn>
        {/* Last */}
        <NavBtn onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} title="Last page">
          <ChevronsRight className="h-3.5 w-3.5" />
        </NavBtn>

        {/* Range text */}
        <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
          {rangeStart}–{rangeEnd}
        </span>
      </div>

      {/* Right: rows per page */}
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
  );
}

function NavBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
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
  );
}
