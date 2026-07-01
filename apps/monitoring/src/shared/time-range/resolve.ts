import { DEFAULT_PRESET_ID, PRESET_BY_ID } from './presets'
import type { ResolvedRange, TimeRangeValue } from './time-range-types'

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Resolve any TimeRangeValue to absolute ISO timestamps + a display label. */
export function resolveTimeRange(value: TimeRangeValue, now: Date): ResolvedRange {
  if (value.kind === 'preset') {
    // Guard against a stale/unknown preset id from persisted state or the URL:
    // fall back to the default preset instead of crashing.
    const def = PRESET_BY_ID[value.preset] ?? PRESET_BY_ID[DEFAULT_PRESET_ID]
    const { from, to } = def.resolve(now)
    return { from, to, label: def.label }
  }
  return { from: value.from, to: value.to, label: `${formatLocal(value.from)} → ${formatLocal(value.to)}` }
}
