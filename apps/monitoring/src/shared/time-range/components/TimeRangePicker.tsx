import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@vnext-forge-studio/designer-ui/ui'

import { cn } from '@monitoring/shared/lib/utils'
import { PRESETS } from '../presets'
import { resolveTimeRange } from '../resolve'
import { useTimeRangeStore } from '../useTimeRangeStore'
import type { TimeRangeValue } from '../time-range-types'

type Tab = 'quick' | 'custom'

export function TimeRangePicker() {
  const value = useTimeRangeStore((s) => s.value)
  const recent = useTimeRangeStore((s) => s.recent)
  const setValue = useTimeRangeStore((s) => s.setValue)
  const isActive = useTimeRangeStore((s) => s.consumerCount > 0)
  const pickerOpen = useTimeRangeStore((s) => s.pickerOpen)
  const setPickerOpen = useTimeRangeStore((s) => s.setPickerOpen)

  const [tab, setTab] = useState<Tab>('quick')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-x/exhaustive-deps
  const now = useMemo(() => new Date(), [value])
  const resolved = useMemo(() => resolveTimeRange(value, now), [value, now])
  const customValid =
    !!draftFrom && !!draftTo && Date.parse(draftFrom) < Date.parse(draftTo)

  function apply(v: TimeRangeValue) {
    setValue(v)
    setPickerOpen(false)
  }

  function applyCustom() {
    if (!customValid) return
    apply({
      kind: 'absolute',
      from: new Date(draftFrom).toISOString(),
      to: new Date(draftTo).toISOString(),
    })
  }

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!isActive}
          title={isActive ? 'Change time range' : 'Not applied on this page'}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
            isActive
              ? 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5'
              : 'cursor-not-allowed border-dashed border-border bg-background text-muted-foreground opacity-60',
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {resolved.label}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Tab bar */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setTab('quick')}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              tab === 'quick'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Quick select
          </button>
          <button
            type="button"
            onClick={() => setTab('custom')}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              tab === 'custom'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Custom range
          </button>
        </div>

        {tab === 'quick' && (
          <div className="p-3">
            {/* Presets grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => {
                const selected = value.kind === 'preset' && value.preset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => apply({ kind: 'preset', preset: p.id })}
                    className={cn(
                      'rounded border px-2 py-1 text-left text-xs transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Recently used */}
            {recent.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recently used
                </p>
                <div className="flex flex-col gap-1">
                  {recent.map((r) => {
                    const label = resolveTimeRange(r, now).label
                    const key = r.kind === 'preset' ? r.preset : `${r.from}__${r.to}`
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => apply(r)}
                        className="rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'custom' && (
          <div className="p-3">
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                From
                <input
                  type="datetime-local"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                To
                <input
                  type="datetime-local"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <button
                type="button"
                onClick={applyCustom}
                disabled={!customValid}
                className={cn(
                  'h-7 rounded px-3 text-xs font-medium transition-colors',
                  customValid
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'cursor-not-allowed bg-muted text-muted-foreground',
                )}
              >
                Apply custom range
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
