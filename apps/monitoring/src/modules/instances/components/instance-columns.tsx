import { createColumnHelper } from '@tanstack/react-table'
import type { NavigateFunction } from 'react-router-dom'
import { StatusBadge } from '@monitoring/shared/components/StatusBadge'
import type { Instance, InstanceStatus } from '@monitoring/shared/types'
import type { FilterableColumn } from '@monitoring/shared/components/data-table'

const col = createColumnHelper<Instance>()

const STATUS_CODE_MAP: Record<string, InstanceStatus> = {
  A: 'Active', B: 'Busy', C: 'Completed', F: 'Faulted', S: 'Suspended', T: 'Terminated',
}

function resolveStatus(code: string | undefined): InstanceStatus {
  if (!code) return 'Active'
  if (code.length > 1) return code as InstanceStatus
  return STATUS_CODE_MAP[code] ?? 'Active'
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
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
              `/definitions/workflows/${wfId ?? ''}/instances/${info.row.original.id}`,
            )
          }
          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
        >
          {info.getValue()}
        </button>
      ),
    }),
    col.accessor('flowVersion', {
      header: 'Version',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">{info.getValue() ?? '—'}</span>
      ),
    }),
    col.display({
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: (info) => (
        <StatusBadge status={resolveStatus(info.row.original.metadata?.status)} />
      ),
    }),
    col.display({
      id: 'currentState',
      header: 'Current State',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs">{info.row.original.metadata?.currentState ?? '—'}</span>
      ),
    }),
    col.display({
      id: 'effectiveState',
      header: 'Effective State',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs">{info.row.original.metadata?.effectiveState ?? '—'}</span>
      ),
    }),
    col.display({
      id: 'effectiveStateType',
      header: 'State Type',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.row.original.metadata?.effectiveStateType ?? '—'}
        </span>
      ),
    }),
    col.display({
      id: 'effectiveStateSubType',
      header: 'State Sub-Type',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.row.original.metadata?.effectiveStateSubType ?? '—'}
        </span>
      ),
    }),
    col.display({
      id: 'createdAt',
      header: 'Created At',
      cell: (info) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {formatDateTime(info.row.original.metadata?.createdAt)}
        </span>
      ),
    }),
    col.display({
      id: 'modifiedAt',
      header: 'Modified At',
      cell: (info) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {formatDateTime(info.row.original.metadata?.modifiedAt)}
        </span>
      ),
    }),
  ]
}

export const INSTANCE_FILTERABLE_COLUMNS: FilterableColumn[] = [
  { id: 'key',               label: 'Instance Key',          type: 'text' },
  { id: 'flow',              label: 'Workflow',               type: 'text' },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    // Backend accepts the full name or its single-char code; we send the name.
    options: [
      { label: 'Active',    value: 'Active' },
      { label: 'Busy',      value: 'Busy' },
      { label: 'Completed', value: 'Completed' },
      { label: 'Faulted',   value: 'Faulted' },
      { label: 'Passive',   value: 'Passive' },
    ],
    graphqlOperators: ['eq', 'ne', 'contains', 'in', 'nin'],
  },
  { id: 'state',             label: 'State',                  type: 'text' },
  { id: 'effectiveState',    label: 'Effective State',         type: 'text' },
  {
    id: 'effectiveStateType',
    label: 'Effective State Type',
    type: 'select',
    numeric: true,
    options: [
      { label: 'Initial',      value: '1' },
      { label: 'Intermediate', value: '2' },
      { label: 'Finish',       value: '3' },
      { label: 'SubFlow',      value: '4' },
      { label: 'Wizard',       value: '5' },
    ],
    graphqlOperators: ['eq', 'ne', 'gt', 'ge', 'lt', 'le'],
  },
  {
    id: 'effectiveStateSubType',
    label: 'Effective State Sub-Type',
    type: 'select',
    numeric: true,
    options: [
      { label: 'None',       value: '0' },
      { label: 'Success',    value: '1' },
      { label: 'Error',      value: '2' },
      { label: 'Terminated', value: '3' },
      { label: 'Suspended',  value: '4' },
      { label: 'Busy',       value: '5' },
      { label: 'Human',      value: '6' },
      { label: 'Cancelled',  value: '7' },
      { label: 'Timeout',    value: '8' },
    ],
    graphqlOperators: ['eq', 'ne', 'gt', 'ge', 'lt', 'le'],
  },
  { id: 'createdAt',         label: 'Created At',             type: 'date' },
  { id: 'modifiedAt',        label: 'Modified At',            type: 'date' },
  { id: 'completedAt',       label: 'Completed At',           type: 'date' },
  { id: 'isTransient',       label: 'Is Transient',           type: 'boolean' },
]
