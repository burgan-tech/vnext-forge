import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDefinitionList } from '@monitoring/modules/definitions/api/definitions-queries'
import { useInstanceList } from '@monitoring/modules/instances/api/instances-queries'
import {
  useGlobalTimeRange,
  buildTimeRangeFilter,
  mergeFilters,
  LargeRangeAlert,
  useLargeRangeGuard,
} from '@monitoring/shared/time-range'
import { useTimeRangeStore } from '@monitoring/shared/time-range/useTimeRangeStore'
import { useFaultedInstances } from '@monitoring/modules/faults/api/faults-queries'
import {
  DataTable,
  type DataTablePaginationState,
  filterGroupToJson,
  createEmptyFilterRoot,
  type FilterGroup,
} from '@monitoring/shared/components/data-table'
import {
  FAULT_COLUMNS,
  FAULT_FILTERABLE_COLUMNS,
  normalizeFaultedInstances,
  normalizeInstances,
  type FaultRow,
} from '@monitoring/modules/faults/components/fault-columns'

export function FaultsPage() {
  const navigate = useNavigate()
  const setPickerOpen = useTimeRangeStore((s) => s.setPickerOpen)

  const [selectedWorkflow, setSelectedWorkflow] = useState<'all' | string>('all')
  const selectRef = useRef<HTMLSelectElement>(null)

  const [filterRoot, setFilterRoot] = useState<FilterGroup>(createEmptyFilterRoot)
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({
    field: 'createdAt',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { resolved } = useGlobalTimeRange()

  // Reset page when key inputs change
  useEffect(() => {
    setPage(1)
  }, [filterRoot, selectedWorkflow, resolved.from, resolved.to])

  const isAllMode = selectedWorkflow === 'all'
  const guard = useLargeRangeGuard(resolved, isAllMode)

  // All-workflows query — only runs when selectedWorkflow is 'all'
  // Gate: if range > 30 days, wait until the user explicitly continues before firing.
  const faultedQuery = useFaultedInstances({
    resolved,
    filterRoot,
    page,
    pageSize,
    enabled: isAllMode && (!guard.rangeExceeds30Days || guard.queryAllowed),
  })

  // Per-workflow filter construction
  const perWorkflowFilter = (() => {
    const timeFilter = buildTimeRangeFilter(resolved)
    const statusFilter = JSON.stringify({ status: { eq: 'Faulted' } })
    const groupFilter = filterGroupToJson(filterRoot, FAULT_FILTERABLE_COLUMNS) || null
    const merged = mergeFilters(timeFilter, statusFilter)
    return groupFilter ? mergeFilters(merged, groupFilter) : merged
  })()

  // Per-workflow query — workflowId='' disables it automatically (enabled: Boolean(workflowId))
  const { data: instancesPage, isLoading: loadingInstances, isError: instancesError } =
    useInstanceList({
      workflowId: selectedWorkflow !== 'all' ? selectedWorkflow : '',
      filter: perWorkflowFilter,
      sort: JSON.stringify({ field: sort.field, direction: sort.dir }),
      page,
      pageSize,
    })

  const { data: workflowsPage, isLoading: loadingWorkflows } = useDefinitionList('workflow')

  const isLoading = isAllMode ? faultedQuery.isLoading : loadingInstances
  const isError = isAllMode ? faultedQuery.isError : instancesError

  const rows: FaultRow[] = isAllMode
    ? normalizeFaultedInstances(faultedQuery.data?.items ?? [])
    : normalizeInstances(instancesPage?.items ?? [], selectedWorkflow)

  const apiPagination = isAllMode
    ? faultedQuery.data?.pagination
    : instancesPage?.pagination

  const paginationState: DataTablePaginationState = {
    page,
    pageSize,
    hasNext: apiPagination?.hasNext ?? false,
    onPageChange: setPage,
    onPageSizeChange: (s) => { setPageSize(s); setPage(1) },
    pageSizeOptions: [10, 20, 50, 100],
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold">Faulted Instances</h1>
        <p className="text-xs text-muted-foreground">
          {isAllMode
            ? `All workflows · ${resolved.label}`
            : `Selected workflow · ${resolved.label}`}
        </p>
      </div>

      {/* Workflow selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Workflow</label>
        <select
          ref={selectRef}
          value={selectedWorkflow}
          onChange={(e) => setSelectedWorkflow(e.target.value)}
          disabled={loadingWorkflows}
          className="h-9 min-w-64 rounded-sm border border-border bg-background px-2 text-sm text-foreground shadow-xs focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50 disabled:opacity-50"
        >
          <option value="all">All Workflows</option>
          {(workflowsPage?.items ?? []).map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name} ({wf.version})
            </option>
          ))}
        </select>
      </div>

      {/* Large range alert */}
      {guard.showAlert && (
        <LargeRangeAlert
          onSelectWorkflow={() => {
            guard.dismiss()
            setTimeout(() => selectRef.current?.focus(), 0)
          }}
          onUpdateTimeRange={() => {
            guard.dismiss()
            setPickerOpen(true)
          }}
          onContinue={() => guard.continueAnyway()}
        />
      )}

      {/* DataTable */}
      <DataTable<FaultRow>
        key={isAllMode ? 'faults-all' : 'faults-single'}
        tableId="faults"
        columns={FAULT_COLUMNS}
        data={rows}
        initialColumnVisibility={isAllMode ? {} : { flow: false }}
        isLoading={isLoading}
        isError={isError}
        emptyMessage="No faulted instances in this time range."
        sortBy={sort.field}
        sortDir={sort.dir}
        onSortChange={(col, dir) => {
          if (col && dir) setSort({ field: col, dir })
        }}
        pagination={isAllMode ? undefined : paginationState}
        filterMode="graphql"
        filterRoot={filterRoot}
        onFilterRootChange={setFilterRoot}
        filterableColumns={FAULT_FILTERABLE_COLUMNS}
        onRowClick={(row) => {
          void navigate(`/definitions/workflows/${row.flow}/instances/${row.id}`)
        }}
      />
    </div>
  )
}
