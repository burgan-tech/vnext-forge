import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Input } from '@vnext-forge-studio/designer-ui/ui'
import { cn } from '@monitoring/shared/lib/utils'
import {
  useInstanceList,
  type InstanceTimeFilter,
} from '@monitoring/modules/instances/api/instances-queries'
import {
  createInstanceColumns,
  INSTANCE_FILTERABLE_COLUMNS,
} from '@monitoring/modules/instances/components/instance-columns'
import {
  DataTable,
  createEmptyFilterRoot,
  type FilterGroup,
} from '@monitoring/shared/components/data-table'
import type { InstanceStatus } from '@monitoring/shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_FILTERS: Array<{ label: string; value: InstanceStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Busy', value: 'Busy' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Faulted', value: 'Faulted' },
  { label: 'Suspended', value: 'Suspended' },
  { label: 'Terminated', value: 'Terminated' },
]

const TIME_FILTERS: Array<{ label: string; value: InstanceTimeFilter }> = [
  { label: 'All', value: 'all' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
]

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
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
  )
}

// ---------------------------------------------------------------------------
// InstanceListPage
// ---------------------------------------------------------------------------

export function InstanceListPage() {
  const { wfId } = useParams<{ wfId: string }>()
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState<InstanceStatus | 'all'>('all')
  const [timeFilter, setTimeFilter] = useState<InstanceTimeFilter>('all')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [filterRoot, setFilterRoot] = useState<FilterGroup>(createEmptyFilterRoot())

  const { data, isLoading, isError } = useInstanceList({
    workflowId: wfId ?? '',
    status: statusFilter,
    timeFilter,
    sort: sortDir,
    search: search || undefined,
    page,
    pageSize,
  })

  const items = data?.items ?? []
  const pagination = data?.pagination
  const hasNext = pagination?.hasNext ?? false
  const total = data?.total

  const columns = useMemo(() => createInstanceColumns(navigate, wfId), [navigate, wfId])

  function handleSortChange(_col: string | null, dir: 'asc' | 'desc' | null) {
    setSortDir(dir ?? 'desc')
    setPage(1)
  }

  const toolbarContent = (
    <div className="flex flex-col gap-2">
      <div className="w-60">
        <Input
          placeholder="Search by instance key… (Enter)"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setSearch(searchDraft); setPage(1) }
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status:</span>
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={statusFilter === f.value}
            onClick={() => {
              setStatusFilter(f.value)
              setPage(1)
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Time:</span>
        {TIME_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={timeFilter === f.value}
            onClick={() => {
              setTimeFilter(f.value)
              setPage(1)
            }}
          />
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {wfId ? `Instances — ${wfId}` : 'All Instances'}
        </h1>
        {total != null && (
          <span className="text-sm text-muted-foreground">
            {total} instance{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <DataTable
        tableId="instances"
        columns={columns}
        data={items}
        isLoading={isLoading}
        isError={isError}
        errorMessage="Failed to load instances."
        emptyMessage="No instances found."
        sortBy="createdAt"
        sortDir={sortDir}
        onSortChange={handleSortChange}
        pagination={{
          page,
          pageSize,
          hasNext,
          totalCount: total,
          onPageChange: setPage,
          onPageSizeChange: (s) => {
            setPageSize(s)
            setPage(1)
          },
        }}
        toolbarContent={toolbarContent}
        filterableColumns={INSTANCE_FILTERABLE_COLUMNS}
        filterRoot={filterRoot}
        onFilterRootChange={(r) => {
          setFilterRoot(r)
          setPage(1)
        }}
      />
    </div>
  )
}
