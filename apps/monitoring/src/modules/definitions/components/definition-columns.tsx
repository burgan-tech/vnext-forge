import { createColumnHelper } from '@tanstack/react-table'
import { Badge } from '@vnext-forge-studio/designer-ui/ui'
import type { DefinitionListItem, ApiComponentLabel } from '@monitoring/shared/types/definitions-api'
import type { DefinitionType } from '@monitoring/modules/definitions/api/definitions-queries'

const col = createColumnHelper<DefinitionListItem>()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  F: 'Flow',
  C: 'Core',
  S: 'SubFlow',
  P: 'SubProcess',
}
const WORKFLOW_TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary' | 'success'> = {
  F: 'info',
  C: 'success',
  S: 'warning',
  P: 'secondary',
}
const SCOPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary' | 'success'> = {
  D: 'info',
  F: 'warning',
  I: 'success',
}

function getLabel(labels?: ApiComponentLabel[]): string {
  if (!labels?.length) return '—'
  return (
    labels.find((l) => l.language === 'en-US')?.label ??
    labels.find((l) => l.language === 'tr-TR')?.label ??
    labels.find((l) => l.language.startsWith('en'))?.label ??
    labels.find((l) => l.language.startsWith('tr'))?.label ??
    labels[0]?.label ??
    '—'
  )
}

// ---------------------------------------------------------------------------
// Shared columns used in every type
// ---------------------------------------------------------------------------

const keyCol = col.accessor('id', {
  header: 'Key',
  enableHiding: false,
  enableSorting: false,
  cell: (info) => (
    <span className="font-mono text-sm font-medium text-foreground">{info.getValue()}</span>
  ),
})

const versionCol = col.accessor('version', {
  header: 'Version',
  enableSorting: false,
  cell: (info) => <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>,
})

const domainCol = col.accessor('domain', {
  header: 'Domain',
  enableSorting: false,
  cell: (info) => <span className="font-mono text-xs text-muted-foreground">{info.getValue()}</span>,
})

const labelsCol = col.accessor('labels', {
  id: 'labels',
  header: 'Label',
  enableSorting: false,
  cell: (info) => (
    <span className="text-xs text-muted-foreground">{getLabel(info.getValue())}</span>
  ),
})

// ---------------------------------------------------------------------------
// Per-type column sets
// ---------------------------------------------------------------------------

const workflowColumns = [
  keyCol,
  col.accessor('type', {
    id: 'type',
    header: 'Type',
    enableSorting: false,
    cell: (info) => {
      const t = info.getValue() ?? 'F'
      return (
        <Badge
          variant={WORKFLOW_TYPE_VARIANTS[t] ?? 'secondary'}
          className="font-mono text-xs"
        >
          {WORKFLOW_TYPE_LABELS[t] ?? t}
        </Badge>
      )
    },
  }),
  versionCol,
  domainCol,
  labelsCol,
]

const taskColumns = [
  keyCol,
  col.accessor('taskType', {
    header: 'Type',
    enableSorting: false,
    cell: (info) => (
      <Badge
        variant={info.getValue() === 'Http' ? 'info' : 'secondary'}
        className="font-mono text-xs"
      >
        {info.getValue() ?? '—'}
      </Badge>
    ),
  }),
  versionCol,
  domainCol,
  col.accessor('deprecated', {
    header: 'Status',
    enableSorting: false,
    cell: (info) =>
      info.getValue() ? (
        <Badge variant="destructive" className="text-xs">
          Deprecated
        </Badge>
      ) : null,
  }),
]

const functionColumns = [
  keyCol,
  col.accessor('scope', {
    id: 'scope',
    header: 'Scope',
    enableSorting: false,
    cell: (info) => {
      const s = info.getValue() ?? ''
      return (
        <Badge variant={SCOPE_VARIANTS[s] ?? 'secondary'} className="font-mono text-xs">
          {s || '—'}
        </Badge>
      )
    },
  }),
  versionCol,
  labelsCol,
]

const mappingColumns = [
  keyCol,
  versionCol,
  col.accessor('usedBy', {
    header: 'Used By',
    enableSorting: false,
    cell: (info) => (
      <span className="text-xs text-muted-foreground">{info.getValue()?.join(', ') || '—'}</span>
    ),
  }),
]

const extensionColumns = [
  keyCol,
  col.accessor('type', {
    id: 'ext-type',
    header: 'Type',
    enableSorting: false,
    cell: (info) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {info.getValue() ?? '—'}
      </Badge>
    ),
  }),
  col.accessor('scope', {
    id: 'ext-scope',
    header: 'Scope',
    enableSorting: false,
    cell: (info) => {
      const s = info.getValue() ?? ''
      return (
        <Badge variant={SCOPE_VARIANTS[s] ?? 'secondary'} className="font-mono text-xs">
          {s || '—'}
        </Badge>
      )
    },
  }),
  labelsCol,
]

const schemaColumns = [
  keyCol,
  col.accessor('type', {
    id: 'schema-type',
    header: 'Type',
    enableSorting: false,
    cell: (info) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {info.getValue() ?? '—'}
      </Badge>
    ),
  }),
  versionCol,
  labelsCol,
]

const viewColumns = [
  keyCol,
  col.accessor('type', {
    id: 'view-type',
    header: 'Type',
    enableSorting: false,
    cell: (info) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {info.getValue() ?? '—'}
      </Badge>
    ),
  }),
  col.accessor('display', {
    header: 'Display',
    enableSorting: false,
    cell: (info) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {info.getValue() ?? '—'}
      </Badge>
    ),
  }),
  col.accessor('renderer', {
    header: 'Renderer',
    enableSorting: false,
    cell: (info) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {info.getValue() ?? '—'}
      </Badge>
    ),
  }),
  labelsCol,
]

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function getDefinitionColumns(defType: DefinitionType) {
  switch (defType) {
    case 'workflow':  return workflowColumns
    case 'task':      return taskColumns
    case 'function':  return functionColumns
    case 'mapping':   return mappingColumns
    case 'extension': return extensionColumns
    case 'schema':    return schemaColumns
    case 'view':      return viewColumns
    default:          return workflowColumns
  }
}
