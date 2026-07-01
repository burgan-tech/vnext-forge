import { createColumnHelper } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import { StatusBadge } from '@monitoring/shared/components/StatusBadge'
import type { InstanceStatus } from '@monitoring/shared/types'
import type { FilterableColumn } from '@monitoring/shared/components/data-table'
import type { FaultedInstance } from '../api/faults-queries'
import type { Instance } from '@monitoring/shared/types'

export interface FaultRow {
  id: string
  key: string
  flow: string
  flowVersion: string
  status: string
  state: string
  effectiveState: string
  effectiveStateType: string
  effectiveStateSubType: string
  isTransient: boolean
  createdAt: string
  modifiedAt: string
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function normalizeFaultedInstances(items: FaultedInstance[]): FaultRow[] {
  return items.map((item) => ({
    id: item.id,
    key: item.key,
    flow: item.flow,
    flowVersion: item.flowVersion,
    status: item.metadata.status,
    state: item.metadata.currentState,
    effectiveState: item.metadata.effectiveState,
    effectiveStateType: item.metadata.effectiveStateType,
    effectiveStateSubType: item.metadata.effectiveStateSubType ?? '',
    isTransient: false,
    createdAt: item.metadata.createdAt,
    modifiedAt: item.metadata.modifiedAt,
  }))
}

export function normalizeInstances(items: Instance[], workflowId: string): FaultRow[] {
  return items.map((item) => ({
    id: item.id,
    key: item.key,
    flow: item.flow ?? workflowId,
    flowVersion: item.flowVersion ?? item.workflowVersion ?? '',
    status: item.status ?? '',
    state: item.metadata?.currentState ?? item.state ?? '',
    effectiveState: item.metadata?.effectiveState ?? '',
    effectiveStateType: item.metadata?.effectiveStateType ?? '',
    effectiveStateSubType: item.metadata?.effectiveStateSubType ?? '',
    isTransient: false,
    createdAt: item.metadata?.createdAt ?? item.createdAt ?? '',
    modifiedAt: item.metadata?.modifiedAt ?? item.updatedAt ?? item.createdAt ?? '',
  }))
}

const col = createColumnHelper<FaultRow>()

export const FAULT_COLUMNS: ColumnDef<FaultRow, any>[] = [
  col.accessor('key', {
    header: 'Instance Key',
    enableSorting: false,
    enableHiding: false,
    cell: (info) => (
      <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{info.getValue()}</span>
    ),
  }),
  col.accessor('flow', {
    header: 'Flow',
    enableSorting: false,
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  col.accessor('flowVersion', {
    header: 'Version',
    enableSorting: false,
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">{info.getValue() || '—'}</span>
    ),
  }),
  col.accessor('status', {
    header: 'Status',
    enableSorting: false,
    cell: (info) => (
      <StatusBadge status={info.getValue() as InstanceStatus} />
    ),
  }),
  col.accessor('state', {
    header: 'State',
    enableSorting: false,
    cell: (info) => (
      <span className="font-mono text-xs">{info.getValue() || '—'}</span>
    ),
  }),
  col.accessor('createdAt', {
    header: 'Created At',
    enableSorting: true,
    cell: (info) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(info.getValue())}</span>
    ),
  }),
]

export const FAULT_FILTERABLE_COLUMNS: FilterableColumn[] = [
  { id: 'key',               label: 'Instance Key',          type: 'text' },
  { id: 'flow',              label: 'Workflow',               type: 'text' },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active',     value: 'Active' },
      { label: 'Busy',       value: 'Busy' },
      { label: 'Completed',  value: 'Completed' },
      { label: 'Faulted',    value: 'Faulted' },
      { label: 'Suspended',  value: 'Suspended' },
      { label: 'Terminated', value: 'Terminated' },
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
  { id: 'isTransient',       label: 'Is Transient',           type: 'boolean' },
]
