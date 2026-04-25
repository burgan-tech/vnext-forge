# ADR 003: Runtime / server health — binary today, `degraded` deferred

**Status:** Accepted

## Context

Operators and UIs sometimes want a **graded** health signal (`ok` / `degraded` / `down`). The codebase today exposes a **minimal liveness** endpoint without dependency-aware degradation semantics.

## Decision

- **Today:** HTTP `/api/health` returns a **binary** success payload (e.g. `{ status: 'ok', traceId }` in `apps/server/src/index.ts`) — effectively **up/down** at the process edge.
- **Deferred:** A `degraded` state is **not** introduced until **runtime**, **UI**, and a **feature flag** agree on a single enum and behavior in **one PR** (avoid half-shipped semantics).

## Criteria to introduce `degraded` (future PR, all in one)

1. **Parser / contract:** `ApiResponse` or a dedicated health DTO defines `status: 'ok' | 'degraded' | 'down'` (exact names TBD) with documented rules.
2. **Runtime checks:** which subsystems flip `degraded` (e.g. runtime proxy unreachable, disk full, optional LSP down) vs hard `down`.
3. **UI behavior:** what the designer shows for `degraded` (banner vs blocking modal vs silent badge).
4. **Feature flag:** default off or safe default until validated.

## Consequences

- No false sense of "partial health" without UX and contract support.
- Today's health remains suitable for **liveness probes** only.

## Alternatives considered

- **Add `degraded` immediately** — rejected: risks misleading signal without coordinated UI/runtime semantics.
