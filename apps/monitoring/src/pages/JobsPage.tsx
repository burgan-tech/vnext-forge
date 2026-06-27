import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDefinitionList } from '@monitoring/modules/definitions/api/definitions-queries'
import {
  useGlobalTimeRange,
  LargeRangeAlert,
  useLargeRangeGuard,
} from '@monitoring/shared/time-range'
import { useTimeRangeStore } from '@monitoring/shared/time-range/useTimeRangeStore'
import { config } from '@monitoring/shared/config/config'
import { DataTable, type DataTablePaginationState } from '@monitoring/shared/components/data-table'
import { useDomainJobs, useWorkflowJobs } from '@monitoring/modules/jobs/api/jobs-queries'
import { JOB_COLUMNS, normalizeJobs, type JobRow } from '@monitoring/modules/jobs/components/job-columns'

export function JobsPage() {
  const navigate = useNavigate()
  const setPickerOpen = useTimeRangeStore((s) => s.setPickerOpen)
  const selectRef = useRef<HTMLSelectElement>(null)

  const [selectedWorkflow, setSelectedWorkflow] = useState<'all' | string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { resolved } = useGlobalTimeRange()
  const isAllMode = selectedWorkflow === 'all'
  const guard = useLargeRangeGuard(resolved, isAllMode)

  // Reset page when scope or range changes (workflow mode is the only paginated one).
  useEffect(() => {
    setPage(1)
  }, [selectedWorkflow, resolved.from, resolved.to])

  // Domain-wide query — gated behind the large-range alert, same as Faults.
  const domainQuery = useDomainJobs({
    resolved,
    enabled: isAllMode && (!guard.rangeExceeds30Days || guard.queryAllowed),
  })

  // Workflow-scoped query — workflow='' disables it automatically.
  const workflowQuery = useWorkflowJobs({
    workflow: isAllMode ? '' : selectedWorkflow,
    resolved,
    page,
    pageSize,
  })

  const { data: workflowsPage, isLoading: loadingWorkflows } = useDefinitionList('workflow')

  const isLoading = isAllMode ? domainQuery.isLoading : workflowQuery.isLoading
  const isError = isAllMode ? domainQuery.isError : workflowQuery.isError

  const rows: JobRow[] = isAllMode
    ? normalizeJobs(domainQuery.data?.jobs ?? [])
    : normalizeJobs(workflowQuery.data?.jobs ?? [])

  // Domain-wide returns a flat list → no pagination bar. Workflow-scoped is paginated.
  const paginationState: DataTablePaginationState | undefined = isAllMode
    ? undefined
    : {
        page,
        pageSize,
        hasNext: workflowQuery.data?.pagination?.hasNext ?? false,
        onPageChange: setPage,
        onPageSizeChange: (s) => {
          setPageSize(s)
          setPage(1)
        },
        pageSizeOptions: [10, 20, 50, 100],
      }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold">Active Jobs</h1>
        <p className="text-xs text-muted-foreground">
          {isAllMode ? `All workflows · ${resolved.label}` : `Selected workflow · ${resolved.label}`}
          {' · '}domain <span className="font-mono text-foreground">{config.domain}</span>
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

      {/* DataTable — no filters (jobs has no external filter set) */}
      <DataTable<JobRow>
        key={isAllMode ? 'jobs-all' : 'jobs-single'}
        tableId="jobs"
        columns={JOB_COLUMNS}
        data={rows}
        initialColumnVisibility={isAllMode ? {} : { flow: false }}
        isLoading={isLoading}
        isError={isError}
        emptyMessage="No active jobs in this time range."
        pagination={paginationState}
        onRowClick={(row) => {
          void navigate(`/definitions/workflows/${row.flow}/instances/${row.instanceId}`)
        }}
      />
    </div>
  )
}
