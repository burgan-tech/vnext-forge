---
name: error-taxonomy
description: Scope is repo-wide. Authoritative guide for the error contract built around `ERROR_CODES`, `VnextForgeError`, `ApiResponse<T>`, and `error-presentation`. Trigger this skill whenever throwing, catching, mapping, displaying, or testing errors anywhere in the monorepo (apps/*, packages/*). See ADR 005.
---

# Error Taxonomy

> **Scope:** Repo-wide. Always reference `@vnext-forge-studio/app-contracts` as the single source of truth.

## Source of truth

- **Codes**: `packages/app-contracts/src/error/error-codes.ts` — `ERROR_CODES` constant + `ErrorCode` type. **Add a new code here first**, never inline.
- **Error type**: `packages/app-contracts/src/error/vnext-error.ts` — `VnextForgeError`. Every domain/service `throw` is a `VnextForgeError`.
- **Envelope**: `packages/app-contracts/src/response/envelope.ts` — `ApiSuccess<T>` / `ApiFailure`. Every API result is wrapped.
- **Presentation map**: `packages/app-contracts/src/error/error-presentation.ts` — `code → severity + user copy`. **All UI text comes from here**, not from raw `error.message`.
- **ADR**: [`docs/architecture/adr/005-error-taxonomy.md`](../../../../docs/architecture/adr/005-error-taxonomy.md).

## Rules (must)

1. **Throw `VnextForgeError`** with a stable `code` from `ERROR_CODES`. Provide `context.source` (`"FileService.writeFile"`) and `context.layer` (`presentation | feature | domain | infrastructure | transport`).
2. **Never** throw `new Error(...)` from domain or service code. `Error` is reserved for unexpected programmer mistakes; the global handler will tag those `INTERNAL_*`.
3. **Never** branch on `error.message.includes(...)`. Branch on `error.code`.
4. **UI shows** `error.toUserMessage().message` (or the presentation map output). UI **must not** show raw `error.message`.
5. **Server error path** always returns the `ApiFailure` envelope with `error.code`, `error.message` (user-safe), and `error.traceId`. The `errorHandler` middleware owns this translation; route handlers do not hand-craft failure JSON.
6. **`traceId`** is preserved end-to-end. If the server attached one, the web layer keeps it on `VnextForgeError.traceId`.
7. **Adding a new code**:
   - Add to `ERROR_CODES`.
   - Update `error-presentation.ts` with severity + copy.
   - If the failure is recoverable, document the recovery hint in copy.

## Don'ts

- Don't create per-feature error subclasses for ordinary API failures.
- Don't store a UI-only error object alongside `VnextForgeError`.
- Don't leak `Zod` issues directly to UI — wrap them via the validation handler so they become `VALIDATION_*` codes.
- Don't translate codes inside hot UI paths; the presentation map is the only translator.

## Quick recipe

```ts
// service / handler
import { VnextForgeError, ERROR_CODES } from '@vnext-forge-studio/app-contracts';

throw new VnextForgeError(ERROR_CODES.RUNTIME_CONNECTION_FAILED, {
  source: 'RuntimeProxyService.proxy',
  layer: 'infrastructure',
  cause: e,
  details: { runtimeUrl, fullUrl, method },
});
```

```tsx
// web UI
const { error } = useAsync(projectApi.list);
if (error) {
  const view = toErrorPresentation(error);
  return <ErrorBanner severity={view.severity}>{view.title}</ErrorBanner>;
}
```

## Cross-references

- [`docs/architecture/adr/005-error-taxonomy.md`](../../../../docs/architecture/adr/005-error-taxonomy.md)
- [`docs/architecture/adr/002-trace-headers.md`](../../../../docs/architecture/adr/002-trace-headers.md) — pair `traceId` with the trace contract.
- `apps/server/src/shared/middleware/error-handler.ts` — the single translation boundary on the server.
