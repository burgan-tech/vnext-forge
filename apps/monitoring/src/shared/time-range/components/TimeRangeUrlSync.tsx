import { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { PRESET_BY_ID } from '../presets'
import { useTimeRangeStore } from '../useTimeRangeStore'
import type { PresetId, TimeRangeValue } from '../time-range-types'

function parseFromUrl(params: URLSearchParams): TimeRangeValue | null {
  const range = params.get('range')
  if (range && range in PRESET_BY_ID) {
    return { kind: 'preset', preset: range as PresetId }
  }
  const from = params.get('from')
  const to = params.get('to')
  if (from && to && !Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(to))) {
    return { kind: 'absolute', from, to }
  }
  return null
}

/**
 * Bridges the time-range store and the URL. On first mount, a valid range in
 * the URL wins over the persisted value. Afterwards, store changes are written
 * back to the URL (replace, so history is not spammed). Renders nothing.
 */
export function TimeRangeUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const value = useTimeRangeStore((s) => s.value)
  const setValue = useTimeRangeStore((s) => s.setValue)
  const hydrated = useRef(false)
  const mirrorMounted = useRef(false)

  // Hydrate once from the URL (URL wins over persisted default).
  // If the URL has no range params, write the current store value there so the
  // active range is always visible in the URL — even on first load with the default.
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const fromUrl = parseFromUrl(searchParams)
    if (fromUrl) {
      setValue(fromUrl)
    } else {
      const next = new URLSearchParams(searchParams)
      next.delete('range')
      next.delete('from')
      next.delete('to')
      if (value.kind === 'preset') {
        next.set('range', value.preset)
      } else {
        next.set('from', value.from)
        next.set('to', value.to)
      }
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-x/exhaustive-deps
  }, [])

  // Mirror store value -> URL on value change or navigation.
  // Navigation (pathname change) clears query params, so we re-stamp the range
  // after every route transition in addition to after every value change.
  // The first run is skipped so we don't clobber a URL range that was just
  // hydrated by the effect above (both effects fire in the same commit).
  useEffect(() => {
    if (!mirrorMounted.current) {
      mirrorMounted.current = true
      return
    }
    const next = new URLSearchParams(searchParams)
    next.delete('range')
    next.delete('from')
    next.delete('to')
    if (value.kind === 'preset') {
      next.set('range', value.preset)
    } else {
      next.set('from', value.from)
      next.set('to', value.to)
    }
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-x/exhaustive-deps
  }, [value, pathname])

  return null
}
