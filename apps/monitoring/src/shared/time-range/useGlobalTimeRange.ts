import { useEffect, useMemo } from 'react'

import { resolveTimeRange } from './resolve'
import { useTimeRangeStore } from './useTimeRangeStore'
import type { ResolvedRange, TimeRangeValue } from './time-range-types'

export interface GlobalTimeRange {
  value: TimeRangeValue
  resolved: ResolvedRange
  setValue: (v: TimeRangeValue) => void
}

/**
 * Opt a page/widget into the global time range. Registers the caller as a
 * consumer (so the Topbar picker renders active) for the component's lifetime.
 */
export function useGlobalTimeRange(): GlobalTimeRange {
  const value = useTimeRangeStore((s) => s.value)
  const setValue = useTimeRangeStore((s) => s.setValue)
  const registerConsumer = useTimeRangeStore((s) => s.registerConsumer)
  const unregisterConsumer = useTimeRangeStore((s) => s.unregisterConsumer)

  useEffect(() => {
    registerConsumer()
    return () => unregisterConsumer()
  }, [registerConsumer, unregisterConsumer])

  // Resolve per `value` (not per render) so `resolved` is reference-stable and
  // safe to use in query keys / effect deps. Relative presets re-resolve only
  // when the selected value changes, which is the right cadence here.
  const resolved = useMemo(() => resolveTimeRange(value, new Date()), [value])
  return { value, resolved, setValue }
}
