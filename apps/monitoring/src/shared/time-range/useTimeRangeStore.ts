import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_RANGE } from './presets'
import type { TimeRangeValue } from './time-range-types'

const MAX_RECENT = 5

function sameValue(a: TimeRangeValue, b: TimeRangeValue): boolean {
  if (a.kind === 'preset' && b.kind === 'preset') return a.preset === b.preset
  if (a.kind === 'absolute' && b.kind === 'absolute') return a.from === b.from && a.to === b.to
  return false
}

interface TimeRangeState {
  value: TimeRangeValue
  recent: TimeRangeValue[]
  consumerCount: number
  pickerOpen: boolean
  setValue: (v: TimeRangeValue) => void
  registerConsumer: () => void
  unregisterConsumer: () => void
  setPickerOpen: (open: boolean) => void
}

export const useTimeRangeStore = create<TimeRangeState>()(
  persist(
    (set) => ({
      value: DEFAULT_RANGE,
      recent: [],
      consumerCount: 0,
      pickerOpen: false,
      setValue: (v) =>
        set((s) => ({
          value: v,
          recent: [v, ...s.recent.filter((r) => !sameValue(r, v))].slice(0, MAX_RECENT),
        })),
      registerConsumer: () => set((s) => ({ consumerCount: s.consumerCount + 1 })),
      unregisterConsumer: () => set((s) => ({ consumerCount: Math.max(0, s.consumerCount - 1) })),
      setPickerOpen: (open) => set({ pickerOpen: open }),
    }),
    {
      name: 'monitoring-time-range',
      partialize: (s) => ({ value: s.value, recent: s.recent }),
    },
  ),
)
