import type { ResolvedRange } from './time-range-types'

/**
 * Flip to true when the monitoring backend accepts `from`/`to` date params.
 * While false, consuming queries must add these params to neither the request
 * nor their query key (avoids pointless refetches returning identical data).
 */
export const TIME_RANGE_QUERY_ENABLED = false

/** Build date query params for a resolved range. Returns {} while disabled. */
export function buildTimeRangeQuery(resolved: ResolvedRange): Record<string, string> {
  if (!TIME_RANGE_QUERY_ENABLED) return {}
  return { from: resolved.from, to: resolved.to }
}
