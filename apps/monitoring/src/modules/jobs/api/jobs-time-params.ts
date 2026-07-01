import type { ResolvedRange } from '@monitoring/shared/time-range'

/**
 * Build left-handed bracket-notation time-range params for the jobs endpoints.
 * The brackets are URL-encoded downstream by URLSearchParams in api-client.
 */
export function buildJobsTimeParams(resolved: ResolvedRange): Record<string, string> {
  const params: Record<string, string> = {}
  if (resolved.from) params['createdAt[gte]'] = resolved.from
  if (resolved.to) params['createdAt[lte]'] = resolved.to
  return params
}
