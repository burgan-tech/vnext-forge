import { createColumnHelper } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@vnext-forge-studio/designer-ui/ui'
import type { JobRow } from './job-row'

export { normalizeJobs } from './job-row'
export type { JobRow } from './job-row'

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const col = createColumnHelper<JobRow>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const JOB_COLUMNS: ColumnDef<JobRow, any>[] = [
  col.accessor('jobId', {
    header: 'Job ID',
    enableSorting: false,
    enableHiding: false,
    cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  col.accessor('name', {
    header: 'Name',
    enableSorting: false,
    cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  col.accessor('flow', {
    header: 'Workflow',
    enableSorting: false,
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  col.accessor('instanceId', {
    header: 'Instance',
    enableSorting: false,
    cell: (info) => (
      <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{info.getValue()}</span>
    ),
  }),
  col.accessor('isActive', {
    header: 'Status',
    enableSorting: false,
    cell: (info) => (
      <Badge variant={info.getValue() ? 'success' : 'secondary'} className="text-xs">
        {info.getValue() ? 'Active' : 'Inactive'}
      </Badge>
    ),
  }),
  col.accessor('createdAt', {
    header: 'Created At',
    enableSorting: false,
    cell: (info) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(info.getValue())}
      </span>
    ),
  }),
  col.accessor('modifiedAt', {
    header: 'Modified At',
    enableSorting: false,
    cell: (info) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(info.getValue())}
      </span>
    ),
  }),
]
