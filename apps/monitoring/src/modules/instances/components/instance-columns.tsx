import { createColumnHelper } from '@tanstack/react-table'
import type { NavigateFunction } from 'react-router-dom'
import { StatusBadge } from '@monitoring/shared/components/StatusBadge'
import { config } from '@monitoring/shared/config/config'
import type { Instance } from '@monitoring/shared/types'
import type { FilterableColumn } from '@monitoring/shared/components/data-table'

const col = createColumnHelper<Instance>()

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatDuration(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function createInstanceColumns(navigate: NavigateFunction, wfId?: string) {
  return [
    col.accessor('key', {
      header: 'Instance Key',
      enableHiding: false,
      enableSorting: false,
      cell: (info) => (
        <button
          type="button"
          onClick={() =>
            navigate(
              `/instances/${info.row.original.id}?workflow=${wfId ?? ''}&domain=${config.domain}`,
            )
          }
          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
        >
          {info.getValue()}
        </button>
      ),
    }),
    col.accessor('workflowVersion', {
      header: 'Version',
      enableSorting: false,
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue() ?? '—'}</span>
      ),
    }),
    col.accessor('state', {
      header: 'State',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs">{info.getValue() ?? '—'}</span>
      ),
    }),
    col.accessor('status', {
      header: 'Status',
      enableSorting: false,
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    col.accessor('createdAt', {
      header: 'Created At',
      cell: (info) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(info.getValue())}
        </span>
      ),
    }),
    col.display({
      id: 'duration',
      header: 'Duration',
      enableSorting: false,
      cell: (info) => (
        <span className="text-muted-foreground">
          {formatDuration(
            info.row.original.createdAt,
            info.row.original.updatedAt ?? info.row.original.createdAt,
          )}
        </span>
      ),
    }),
  ]
}

export const INSTANCE_FILTERABLE_COLUMNS: FilterableColumn[] = [
  { id: 'key', label: 'Instance Key', type: 'text' },
  { id: 'state', label: 'State', type: 'text' },
]
