import { useEffect, useState } from 'react'

import { rangeExceeds30Days } from './largeRange'
import type { ResolvedRange } from './time-range-types'

export interface LargeRangeGuard {
  /** Whether the resolved range spans > 30 days (independent of mode). */
  rangeExceeds30Days: boolean
  /** Show the alert banner: all-mode + large range + not yet dismissed. */
  showAlert: boolean
  /** Whether the gated (all-mode) query is allowed to fire. */
  queryAllowed: boolean
  /** Hide the banner without unblocking the query (select/update actions). */
  dismiss: () => void
  /** Hide the banner AND unblock the query ("Continue anyway"). */
  continueAnyway: () => void
}

/**
 * Owns the 30-day large-range guard used by domain-wide (all-mode) list pages.
 * Resets on every range change so the user re-confirms a fresh large scan.
 */
export function useLargeRangeGuard(resolved: ResolvedRange, isAllMode: boolean): LargeRangeGuard {
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [queryAllowed, setQueryAllowed] = useState(false)

  useEffect(() => {
    setAlertDismissed(false)
    setQueryAllowed(false)
  }, [resolved.from, resolved.to])

  const exceeds = rangeExceeds30Days(resolved)

  return {
    rangeExceeds30Days: exceeds,
    showAlert: isAllMode && exceeds && !alertDismissed,
    queryAllowed,
    dismiss: () => setAlertDismissed(true),
    continueAnyway: () => {
      setAlertDismissed(true)
      setQueryAllowed(true)
    },
  }
}
