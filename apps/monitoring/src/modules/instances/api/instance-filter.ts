import {
  filterGroupToObject,
  type BackendFilter,
  type FilterableColumn,
  type FilterGroup,
} from '@monitoring/shared/components/data-table'
import type { InstanceStatus } from '@monitoring/shared/types'
import type { InstanceTimeFilter } from './instances-queries'

const TIME_FILTER_MS: Record<Exclude<InstanceTimeFilter, 'all'>, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

/**
 * Resolves a relative time chip into an absolute ISO lower bound, used as
 * `{ createdAt: { gt: <iso> } }`. Returns null for the 'all' (no bound) chip.
 */
export function timeFilterToIso(
  timeFilter: InstanceTimeFilter,
  now: number = Date.now(),
): string | null {
  if (timeFilter === 'all') return null
  return new Date(now - TIME_FILTER_MS[timeFilter]).toISOString()
}

export interface InstanceFilterInputs {
  /** Status chip — sent as { status: { eq } }. 'all' contributes nothing. */
  status?: InstanceStatus | 'all'
  /** Time chip — sent as { createdAt: { gt: <iso> } }. */
  timeFilter?: InstanceTimeFilter
  /** Instance id search term — sent as { id: { eq } }. */
  search?: string
  /** Advanced filter-builder tree. */
  filterRoot?: FilterGroup
  /** Column metadata for the advanced filter-builder serialization. */
  columns?: FilterableColumn[]
  /** Injectable clock for deterministic tests. */
  now?: number
}

/**
 * Merges the toolbar chips (status, time, search) and the advanced filter-builder
 * tree into a single backend GraphQL filter object.
 *
 * The backend accepts both a flat implicit-AND object (distinct top-level keys)
 * and explicit { and: [...] } / { or: [...] } combinators. We emit the flat form
 * when every fragment contributes a distinct plain field, and fall back to an
 * explicit { and: [...] } when keys collide or a fragment is itself a combinator.
 *
 * Returns null when no effective filter exists.
 */
export function buildInstanceFilter(inputs: InstanceFilterInputs): BackendFilter | null {
  const fragments: BackendFilter[] = []

  if (inputs.status && inputs.status !== 'all') {
    fragments.push({ status: { eq: inputs.status } })
  }

  const createdAtFrom = timeFilterToIso(inputs.timeFilter ?? 'all', inputs.now)
  if (createdAtFrom) {
    fragments.push({ createdAt: { gt: createdAtFrom } })
  }

  const search = inputs.search?.trim()
  if (search) {
    fragments.push({ id: { eq: search } })
  }

  if (inputs.filterRoot) {
    const builder = filterGroupToObject(inputs.filterRoot, inputs.columns ?? [])
    if (builder) fragments.push(builder)
  }

  return mergeFragments(fragments)
}

/** Serialized form for the `?filter=` query param; null when no filter applies. */
export function buildInstanceFilterParam(inputs: InstanceFilterInputs): string | null {
  const obj = buildInstanceFilter(inputs)
  return obj ? JSON.stringify(obj) : null
}

function mergeFragments(fragments: BackendFilter[]): BackendFilter | null {
  if (fragments.length === 0) return null
  if (fragments.length === 1) return fragments[0]

  const flat: BackendFilter = {}
  for (const frag of fragments) {
    for (const key of Object.keys(frag)) {
      if (key === 'and' || key === 'or' || key === 'not' || key in flat) {
        // Collision or nested combinator — cannot flatten safely; use explicit AND.
        return { and: fragments }
      }
      flat[key] = frag[key]
    }
  }
  return flat
}
