import { useState } from 'react'
import type { OnChangeFn, VisibilityState } from '@tanstack/react-table'

function storageKey(tableId: string): string {
  return `monitoring:table:${tableId}:columns`
}

export function useColumnVisibility(
  tableId: string,
  initialVisibility: VisibilityState = {},
): [VisibilityState, OnChangeFn<VisibilityState>] {
  const [visibility, setVisibilityState] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(storageKey(tableId))
      return stored ? (JSON.parse(stored) as VisibilityState) : initialVisibility
    } catch {
      return initialVisibility
    }
  })

  const setVisibility: OnChangeFn<VisibilityState> = (updater) => {
    setVisibilityState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(storageKey(tableId), JSON.stringify(next))
      } catch {
        // localStorage unavailable (e.g. private browsing) — silently ignore
      }
      return next
    })
  }

  return [visibility, setVisibility]
}
