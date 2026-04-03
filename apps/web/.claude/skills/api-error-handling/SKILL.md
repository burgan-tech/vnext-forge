---
name: api-error-handling
description: Use when implementing or reviewing web error handling in this repo. The web app must normalize failures into the shared repo contract built around `VnextError`, `ErrorCode`, `ErrorCategory`, `traceId`, and `ApiResponse<T>`.
---

# API Error Handling

## Purpose

Use this skill to keep every web error flow aligned with the target architecture.

The goal is simple:

- one shared error contract
- no raw transport errors in UI
- no ad hoc feature-specific error shapes
- deterministic branching based on structured fields

## Repo Rules

- Use the shared repo error contract, not a local app-specific model.
- Normalize failures into `VnextError`.
- Preserve `traceId` whenever the backend or transport gives one.
- Branch on `error.code` and `error.category`, not on message text.
- Treat `ApiResponse<T>` as the transport contract and convert failure states before they reach rendering code.

## Where Errors Belong

Use these boundaries:

1. `shared/api` owns transport concerns and first-pass normalization.
2. Services or adapters own response mapping and contract validation.
3. Feature or entity actions may translate a normalized error into scenario meaning.
4. UI renders user-facing states and messages, but does not invent a second error model.

## Do

- Convert unknown transport failures into `VnextError`.
- Preserve backend error codes when they map cleanly to `ErrorCode`.
- Attach or preserve `traceId` for diagnostics.
- Keep technical diagnostics in structured metadata, not JSX conditionals.
- Use the repo's user-facing conversion such as `toUserMessage()` at the presentation edge.
- Keep the same failure shape across pages, widgets, features, and entities.

## Do Not Do

- Do not return raw `Error`, raw HTTP responses, or raw backend payloads to components.
- Do not branch on `message.includes(...)`.
- Do not create per-feature error classes for ordinary API failures.
- Do not store a second UI-only error object when `VnextError` already exists.
- Do not make components aware of status codes, fetch exceptions, or RPC internals.

## Review Standard

Flag the implementation if:

- UI code catches and interprets transport errors directly.
- A service invents a custom error shape that bypasses `VnextError`.
- A page decides behavior from string messages.
- `traceId` is dropped even though it exists upstream.
- A failure path cannot be traced to `ErrorCode` and `ErrorCategory`.

## Migration Notes

- Prefer target naming such as `@vnext-forge/*` in new docs and code.
- Do not preserve legacy conventions just because the repo still contains migration debt.
