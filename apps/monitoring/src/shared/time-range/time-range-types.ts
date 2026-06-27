export type PresetId =
  | 'last-1h'
  | 'last-12h'
  | 'last-24h'
  | 'last-7d'
  | 'last-30d'
  | 'last-90d'

/** Selected time range. Presets stay relative and re-evaluate on each read. */
export type TimeRangeValue =
  | { kind: 'preset'; preset: PresetId }
  | { kind: 'absolute'; from: string; to: string } // ISO 8601

/** A range resolved to absolute ISO timestamps plus a display label. */
export interface ResolvedRange {
  from: string
  to: string
  label: string
}
