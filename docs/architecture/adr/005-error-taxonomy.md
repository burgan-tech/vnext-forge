# ADR 005: Error taxonomy and stable API codes

**Status:** Accepted

## Context

Clients need **stable machine-readable codes** for branching, telemetry, and UX mapping. Ad hoc strings and HTTP status alone are insufficient.

## Decision

1. **`ERROR_CODES`** in `@vnext-forge-studio/app-contracts` (`packages/app-contracts/src/error/error-codes.ts`) is the **single source of truth** for stable failure codes.
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

## Addendum (2026-10-16): Runtime error details

**Status:** Accepted

### Context

`VnextForgeError.context.details` is server-side data: `toFailure()` drops it, and the web server's error handler returned only `{ code, message, traceId }`. The VS Code extension host forwards `details` to its webview unchanged (`apps/extension/src/MessageRouter.ts`, `dispatchApi`), because the host and its webview are one trusted process pair.

When the vNext runtime answers non-2xx, `QuickRunService` (`runtimeHttpError`) throws `RUNTIME_NOT_FOUND` (404) or `RUNTIME_EXECUTION_FAILED` with `details = { httpStatus, ...runtimeBody }`. The QuickRun `RuntimeErrorBanner` (`summarizeRuntimeError`) reads the runtime's code (`error.prefix` / `error.code`), message and validation lines from there, and shows hints for codes such as `Instance:100031` and `Instance:100044`–`100050`. In the web shell all of that was lost: a missing file showed only a generic `RUNTIME_NOT_FOUND` message.

### Decision

The web server forwards a **whitelisted projection** of `details` for one case only (`apps/server/src/shared/middleware/public-error-details.ts`, applied in `jsonErrorResponse`):

1. **Codes:** `RUNTIME_NOT_FOUND` and `RUNTIME_EXECUTION_FAILED` only.
2. **Shape:** only when `details.httpStatus` is a number, which marks a runtime answer built by `runtimeHttpError`. Other `RUNTIME_*` throws carry forge-internal data (`runtimeUrl`, `fullUrl`, `method`, `rawData`, `attemptedRuntimeUrl`) and keep `details` server-side.
3. **Keys:** `httpStatus`; the runtime body's scalar fields `prefix`, `code`, `errorCode`, `type`, `message`, `detail`, `title`, `target`, `traceId` (strings) and `status` (number), read at the top level and inside the Aether `error` envelope; `validationErrors[]` items (`message`, `errorMessage`, `members[]`, `memberNames[]`); `errors` as a list (strings or `code` / `errorCode` / `target` / `message` / `errorMessage` / `detail` / `description`) or as an RFC 7807 field → messages dictionary. Every other key, such as a runtime `stackTrace`, `exception` or `innerError`, is dropped.
4. **Caps:** strings at 1000 characters, lists and dictionaries at 50 entries.
5. The error handler stays the single translation boundary (server-hardening invariant 5); `error.code` and `error.message` are unchanged (`USER_MESSAGES` copy). The extension shape is unchanged.

### Why this is safe

- The forwarded data is the runtime's own answer, not forge state. The `runtime/proxy` method already returns raw runtime response bodies, error bodies included, to the web shell as success data; this adds no new class of exposure.
- No filesystem paths, URLs, config or stack data of the forge server pass the whitelist. Tests in `apps/server/src/__tests__/error-handler.test.ts` pin the projection, the caps, and that connection failures and non-runtime codes keep `details` server-side.
- The ADR 001 posture (loopback default) is unchanged. A non-loopback deployment should still review this list along with the other `BLOCKER-FOR-NON-LOOPBACK` items, because a runtime message can name instance data.

### Consequences

- Web and extension show the same runtime code, lines and hint in the QuickRun error banner (see [web-extension-parity.md](../web-extension-parity.md#runtime-error-details)).
- A new runtime error field the banner should read must be added to the whitelist and its test; it does not appear in the web shell by default.
