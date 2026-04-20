# ADR 005: Error taxonomy and stable API codes

**Status:** Accepted

## Context

Clients need **stable machine-readable codes** for branching, telemetry, and UX mapping. Ad hoc strings and HTTP status alone are insufficient.

## Decision

1. **`ERROR_CODES`** in `@vnext-forge/app-contracts` (`packages/app-contracts/src/error/error-codes.ts`) is the **single source of truth** for stable failure codes.
2. Domain/service failures throw **`VnextForgeError`** with `code`, `layer`, `message`, optional `details` (`packages/app-contracts/src/error/vnext-forge-error.ts`). `ErrorLayer` documents architectural origin (`transport`, `application`, `domain`, `infrastructure`).
3. **Presentation mapping** lives in `packages/app-contracts/src/error/error-presentation.ts` (`code → severity`, recovery hints, copy helpers). UI never string-matches messages.
4. **Contract:** server error paths return JSON **`ApiResponse`** failures whose `error.code` is always a known **`ERROR_CODES`** value (validation / infrastructure mapping centralized in `apps/server/src/shared/middleware/error-handler.ts`).

## Consequences

- UI and extension can evolve copy without changing thrown types.
- New failures require **registering** a code and (usually) a presentation row.
- Trace ids (ADR 002) are merged into every `ApiFailure` envelope so the UI can surface them.

## Alternatives considered

- **HTTP status–only errors** — rejected: loses stable client logic.
- **Per-workspace string enums** — rejected: duplicates and drifts from contracts package.
