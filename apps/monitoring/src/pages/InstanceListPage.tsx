import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input } from '@vnext-forge-studio/designer-ui/ui';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import { cn } from '@monitoring/shared/lib/utils';
import {
  useInstanceList,
  type InstanceTimeFilter,
  type InstanceSortOrder,
} from '@monitoring/modules/instances/api/instances-queries';
import type { Instance, InstanceStatus } from '@monitoring/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ---------------------------------------------------------------------------
// Filter chip helpers
// ---------------------------------------------------------------------------

const STATUS_FILTERS: Array<{ label: string; value: InstanceStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Busy', value: 'Busy' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Faulted', value: 'Faulted' },
  { label: 'Suspended', value: 'Suspended' },
  { label: 'Terminated', value: 'Terminated' },
];

const TIME_FILTERS: Array<{ label: string; value: InstanceTimeFilter }> = [
  { label: 'All', value: 'all' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// InstanceListPage
// ---------------------------------------------------------------------------

export function InstanceListPage() {
  const { wfId } = useParams<{ wfId: string }>();
  const navigate = useNavigate();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<InstanceStatus | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<InstanceTimeFilter>('all');
  const [sort, setSort] = useState<InstanceSortOrder>('desc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading, isError } = useInstanceList({
    workflowId: wfId,
    status: statusFilter,
    timeFilter,
    sort,
    search: search || undefined,
    page,
    pageSize,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleStatusChange(value: InstanceStatus | 'all') {
    setStatusFilter(value);
    setPage(1);
  }

  function handleTimeChange(value: InstanceTimeFilter) {
    setTimeFilter(value);
    setPage(1);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSort(e.target.value as InstanceSortOrder);
    setPage(1);
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPageSize(Number(e.target.value));
    setPage(1);
  }

  // Pagination: show at most 5 page buttons around the current page
  function getPageNumbers(): number[] {
    const delta = 2;
    const range: number[] = [];
    const left = Math.max(1, page - delta);
    const right = Math.min(totalPages, page + delta);
    for (let i = left; i <= right; i++) range.push(i);
    return range;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {wfId ? `Instances — ${wfId}` : 'All Instances'}
        </h1>
        <span className="text-sm text-muted-foreground">
          {total} instance{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="w-64">
          <Input
            placeholder="Search by instance key…"
            value={search}
            onChange={handleSearchChange}
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={handleSortChange}
          className="h-9 rounded-sm border border-border bg-background px-2 text-sm text-foreground shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
        >
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status:</span>
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={statusFilter === f.value}
            onClick={() => handleStatusChange(f.value)}
          />
        ))}
      </div>

      {/* Time filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Time:</span>
        {TIME_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={timeFilter === f.value}
            onClick={() => handleTimeChange(f.value)}
          />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Instance Key</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">State</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Created At</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Duration</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-destructive">
                  Failed to load instances.
                </td>
              </tr>
            )}
            {!isLoading && !isError && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No instances found.
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              items.map((instance: Instance) => (
                <tr
                  key={instance.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/instances/${instance.id}`)}
                      className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {instance.key}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{instance.workflowVersion}</td>
                  <td className="px-4 py-2 font-mono text-xs">{instance.state}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={instance.status} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(instance.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDuration(instance.createdAt, instance.updatedAt)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows per page:</span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="h-8 rounded-sm border border-border bg-background px-2 text-sm text-foreground shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Page buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>

          {getPageNumbers().map((n) => (
            <Button
              key={n}
              variant={n === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPage(n)}
            >
              {n}
            </Button>
          ))}

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>

        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
      </div>
    </div>
  );
}
