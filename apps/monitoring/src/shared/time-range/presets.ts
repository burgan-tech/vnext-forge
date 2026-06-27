import type { PresetId, TimeRangeValue } from './time-range-types'

export interface PresetDef {
  id: PresetId
  label: string
  resolve: (now: Date) => { from: string; to: string }
}

const HOUR = 3_600_000
const DAY = 86_400_000

const ago = (now: Date, ms: number): string => new Date(now.getTime() - ms).toISOString()

export const PRESETS: PresetDef[] = [
  { id: 'last-1h', label: 'Last 1 hour', resolve: (now) => ({ from: ago(now, HOUR), to: now.toISOString() }) },
  { id: 'last-12h', label: 'Last 12 hours', resolve: (now) => ({ from: ago(now, 12 * HOUR), to: now.toISOString() }) },
  { id: 'last-24h', label: 'Last 24 hours', resolve: (now) => ({ from: ago(now, DAY), to: now.toISOString() }) },
  { id: 'last-7d', label: 'Last 7 days', resolve: (now) => ({ from: ago(now, 7 * DAY), to: now.toISOString() }) },
  { id: 'last-30d', label: 'Last 30 days', resolve: (now) => ({ from: ago(now, 30 * DAY), to: now.toISOString() }) },
  { id: 'last-90d', label: 'Last 90 days', resolve: (now) => ({ from: ago(now, 90 * DAY), to: now.toISOString() }) },
]

export const PRESET_BY_ID: Record<PresetId, PresetDef> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p]),
) as Record<PresetId, PresetDef>

export const DEFAULT_PRESET_ID: PresetId = 'last-7d'
export const DEFAULT_RANGE: TimeRangeValue = { kind: 'preset', preset: DEFAULT_PRESET_ID }
