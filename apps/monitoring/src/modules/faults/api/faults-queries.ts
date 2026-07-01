import { useQuery } from '@tanstack/react-query'

import { domainGet } from '@monitoring/shared/api/monitoring-api'
import { filterGroupToJson } from '@monitoring/shared/components/data-table'
import type { FilterGroup } from '@monitoring/shared/components/data-table'
import { mergeFilters } from '@monitoring/shared/time-range'
import type { ResolvedRange } from '@monitoring/shared/time-range'
import { FAULT_FILTERABLE_COLUMNS } from '../components/fault-columns'

export interface FaultedInstance {
  id: string
  key: string
  flow: string
  flowVersion: string
  domain: string
  tags: string[]
  metadata: {
    currentState: string
    effectiveState: string
    status: string
    effectiveStateType: string
    effectiveStateSubType: string
    createdAt: string
    modifiedAt: string
  }
}

export interface FaultedInstancesParams {
  resolved: ResolvedRange
  filterRoot?: FilterGroup
  page?: number
  pageSize?: number
  enabled?: boolean
}

export interface FaultedInstancesResult {
  items: FaultedInstance[]
  pagination?: {
    page: number
    pageSize: number
    hasNext: boolean
  }
}

export function useFaultedInstances(params: FaultedInstancesParams) {
  const { resolved, filterRoot, page = 1, pageSize = 20, enabled = true } = params

  const timeFilter = JSON.stringify({
    createdAt: { gt: resolved.from, lt: resolved.to },
  })
  const groupFilter = filterRoot
    ? filterGroupToJson(filterRoot, FAULT_FILTERABLE_COLUMNS) || null
    : null
  const filter = groupFilter ? mergeFilters(timeFilter, groupFilter) : timeFilter

  const query: Record<string, string> = {
    filter: filter ?? timeFilter,
    page: String(page),
    pageSize: String(pageSize),
  }

  return useQuery({
    queryKey: ['faulted-instances', resolved.from, resolved.to, filterRoot, page, pageSize],
    queryFn: () => domainGet<FaultedInstancesResult>('/instances/faulted', query),
    enabled,
  })
}
