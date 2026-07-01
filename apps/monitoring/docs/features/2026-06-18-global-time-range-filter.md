# Global Time Range Filter — Design Spec

**Date:** 2026-06-18
**Status:** Approved (design) — implementation pending
**Working dir:** `vnext-forge/apps/monitoring/src`

## Goal

A Kibana-style global date/time range control, fixed in the top-right of the
Topbar and reachable from every page. The user picks a relative preset (last
7d / 30d / 90d, etc.) or a custom absolute range; opted-in lists and dashboard
widgets constrain their queries to that range. The purpose is performance:
bounding high-row-count queries by time.

Not every page reacts to it. Pages opt in explicitly. Initial consumers:

- **Dashboard → Instance Distribution** widget (the `last 7 days` label becomes
  dynamic and the data is range-scoped).
- **Faults page** list (faulted instances scoped to the selected range).

The design must let more pages opt in later with no structural change.

## Decisions (locked during brainstorming)

| Topic | Decision |
|-------|----------|
| Persistence | **localStorage + URL.** URL query params win on load; fall back to localStorage default. |
| Visibility | Picker is **always rendered** in the Topbar. On pages that consume the range it is **active**; on pages that do not, it renders **passive/dimmed** with a "not applied here" hint. Position never jumps. |
| Feature scope | Quick presets + custom absolute range + recently-used ranges. **No auto-refresh** (`Refresh every`) in this version. |
| Backend wiring | Backend does not yet accept date params. Build the param **centrally but do not send it** — gated behind a single flag (`TIME_RANGE_QUERY_ENABLED = false`). The picker, persistence, recent list, and **label text** are live now; feeding `from/to` into the API is a one-flag TODO. |
| State idiom | **zustand + `persist`**, matching the existing `useFavorites` store (`monitoring-favorites`). No new React Context idiom. |

## Architecture

zustand store (persisted) holds the selected range + recent ranges. A mounted
`<TimeRangeUrlSync>` hydrates from the URL on load (URL wins) and writes back on
change. Pages opt in via `useGlobalTimeRange()`, which also registers them as a
consumer so the Topbar picker can render active vs. passive. A single
`buildTimeRangeQuery()` helper — gated by `TIME_RANGE_QUERY_ENABLED` — is the
only place that turns the range into API params.

### State model

Stored value is a discriminated union so relative presets stay relative
(re-evaluated on each read, like Kibana `now-7d`) and only custom ranges are
absolute:

```ts
type TimeRangeValue =
  | { kind: 'preset'; preset: PresetId }            // relative
  | { kind: 'absolute'; from: string; to: string }  // ISO 8601

type PresetId =
  | 'last-15m' | 'last-1h' | 'last-24h' | 'today'
  | 'last-7d'  | 'last-30d' | 'last-90d' | 'last-1y'

interface ResolvedRange { from: string; to: string; label: string } // absolute ISO
```

- `PRESETS`: table mapping each `PresetId` → `{ label, resolve(now): { from, to } }`.
- `resolveTimeRange(value, now): ResolvedRange` — resolves any value to absolute
  ISO timestamps + display label, at consumption time.
- Default value: `{ kind: 'preset', preset: 'last-7d' }`.
- Recent list: last **5 distinct** values (presets and absolute both eligible,
  deduped by structural equality), newest first.

### Consumer registration & visibility

- `useGlobalTimeRange()` returns `{ value, resolved, setValue, isActive }`. In a
  `useEffect` it increments `consumerCount` on mount, decrements on unmount.
- `consumerCount` is **not persisted** (zustand `partialize` excludes it; only
  `value` and `recent` persist).
- `<TimeRangePicker>` is active when `consumerCount > 0`, otherwise dimmed/
  disabled with a tooltip ("Not applied on this page.").

### Backend gating

```ts
export const TIME_RANGE_QUERY_ENABLED = false // flip to true when backend is ready
```

While `false`, consuming React Query hooks add `from/to` neither to the request
**nor** to the query key — so changing the range fires no pointless refetches
returning identical data. Label text still updates live. When flipped to `true`,
the same hooks send params and re-key.

Split:
- **Live now:** picker, persistence, URL sync, recent ranges, and the
  dashboard/Faults **label text** reflecting the selection.
- **One-flag TODO:** feeding `from/to` into the API query.

## File structure

New (`shared/time-range/` — cross-cutting infra consumed by multiple modules):

```
shared/time-range/
  time-range-types.ts        TimeRangeValue, PresetId, ResolvedRange
  presets.ts                 PRESETS table + resolvePreset(now)
  resolve.ts                 resolveTimeRange(value, now)
  useTimeRangeStore.ts       zustand+persist (value, recent, consumerCount); partialize excludes consumerCount
  useGlobalTimeRange.ts      consumer hook (registers consumer; returns value/resolved/setValue/isActive)
  buildTimeRangeQuery.ts     param builder + TIME_RANGE_QUERY_ENABLED flag
  index.ts                   barrel
  components/
    TimeRangePicker.tsx      Kibana-style popover: presets grid + custom absolute + recent list
    TimeRangeUrlSync.tsx     mounts once; hydrates from URL (wins) → store, writes store → URL
```

Modified:

- `app/layout/Topbar.tsx` — mount `<TimeRangePicker>` in the right-side actions,
  left of the favorite/refresh icons.
- `app/AppProviders.tsx` (or `AppShell.tsx`) — mount `<TimeRangeUrlSync>` once,
  wherever `useSearchParams` is valid (inside Router context).
- `modules/dashboard/components/InstanceDistSection.tsx` — replace hardcoded
  `last 7 days` (line 50) with the live resolved label.
- `modules/dashboard/api/dashboard-queries.ts` — `useInstanceStats` accepts the
  resolved range; gated params.
- `pages/DashboardPage.tsx` — call `useGlobalTimeRange()`, pass range down.
- `pages/FaultsPage.tsx` — call `useGlobalTimeRange()`, show resolved label,
  gated params on its `useInstanceList`.

## URL encoding

- Preset: `?range=last-7d`
- Absolute: `?from=<ISO>&to=<ISO>`
- On load, if any of these are present they hydrate the store and win over the
  persisted value. On change, the store writes back (replace, not push, to avoid
  spamming history).

## Error handling / edge cases

- Invalid/unknown `range` or unparseable `from/to` in the URL → ignore, fall
  back to persisted/default value.
- Custom range with `from > to` → picker validates and blocks apply.
- Persisted value of an unknown shape (schema drift) → reset to default.

## Testing

Pure logic (`presets.ts`, `resolve.ts`, `buildTimeRangeQuery.ts`) is
unit-testable and should get tests if a runner is wired in the monitoring app
(to be confirmed during planning). Store + URL-sync verified manually. Type
checking via the project's tsc.

## Out of scope (this version)

- Auto-refresh / `Refresh every`.
- Sending `from/to` to the backend (gated TODO).
- Per-page independent ranges (the global range is shared; pages only choose to
  consume it or not).
