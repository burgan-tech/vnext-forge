# Skills Refactor Plan

## Purpose

This document records which parts of the current web skills conflict with the target architecture in `plans/new-architecture.md` and how they should change before the actual refactor work continues.

## Binding Architecture Rules

The refactored skills should consistently teach these repo rules:

1. Web code moves toward the FSD structure: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.
2. Imports flow only downward through the FSD layers.
3. `features` do not import other `features`.
4. `entities` do not import other `entities`.
5. Shared code may be consumed anywhere, but it must stay domain-agnostic.
6. Web transport must move behind the shared Hono RPC client.
7. Raw `fetch` should disappear from `pages`, `widgets`, `features`, and `entities`.
8. Error handling should align with `VnextError`, `ErrorCode`, `ErrorCategory`, `traceId`, and `ApiResponse<T>`.
9. Skills should teach the target package vocabulary such as `@vnext-forge/*`, even if migration debt still exists.
10. Skills should treat `useAsync` as an allowed shared abstraction for reusable async UI flows, but not as a mandatory wrapper for every request.

## Repo Reality To Reflect

The skills should acknowledge migration debt without teaching it as the standard:

- `apps/web/package.json` still references `@vnext-studio/*`.
- Legacy folders and patterns are still present in the web app.
- Raw `fetch` still exists in several web files.
- A shared `useAsync` abstraction is planned and should be used where async UI behavior benefits from a reusable hook contract.
- A notification system is not currently a core architectural primitive.

## Skill Decisions

### 1. `api-error-handling`

Required changes:

- Remove old `FinApp` naming and app-specific language.
- Replace the old error shape guidance with the shared repo contract.
- Make `VnextError` the default normalized failure type.
- Require branching by `error.code` and `error.category`, not by message text.
- Make `traceId` preservation part of the guidance.

### 2. `api-fetching`

Required changes:

- Make the shared Hono RPC client the default API entry point.
- Explicitly ban raw `fetch` in `pages`, `widgets`, `features`, and `entities`.
- Define the intended flow as shared API client -> slice service/action -> optional hook -> UI.
- Push transport concerns into `shared/api`.
- Require normalized success and error contracts before UI render code consumes them.

### 3. `component-creation`

Required changes:

- Replace the generic component taxonomy with the exact FSD layer model from the plan.
- Teach the downward-only import rule explicitly.
- Explicitly ban cross-feature and cross-entity imports.
- Push new components toward the target FSD tree rather than legacy buckets.

### 4. `state-store-handling`

Required changes:

- Reintroduce `useAsync` as an available shared abstraction for reusable async UI state.
- Frame state ownership around FSD slice ownership, lifetime, and reuse.
- Keep transient async state local unless multiple consumers genuinely require promotion.
- Place shared slice state in the owning slice model directory.

### 5. `validation-zod`

Required changes:

- Keep `React Hook Form` and `Zod` guidance for form UX.
- Separate form validation from runtime contract validation.
- Push durable shared rules into packages and boundary layers when appropriate.
- Ensure runtime validation failures align with the shared error contract.

### 6. `useasync-customhook-creation`

Required changes:

- Keep teaching `useAsync`, but only as an optional shared primitive for async UI flows that benefit from reuse.
- Reframe the skill around async feature flow design.
- Keep hooks optional and justified by UI-facing reuse.
- Require async flow to sit on top of the shared API client and normalized error handling.

### 7. `notifcation-container-pattern`

Required changes:

- Treat notification handling as optional infrastructure, not a core architecture rule.
- Clarify that services should not emit notifications.
- Keep notification state ephemeral and feature-triggered.
- Preserve the current directory name for now, but treat the typo as migration debt.

### 8. `theme-color-system`

Required changes:

- Mark the skill as optional and design-system scoped.
- Avoid treating theme token migration as a required part of the structural refactor.
- Keep visual-system changes incremental and separate from architecture migration.

## Refactor Order

The safest order is:

1. `api-error-handling`
2. `api-fetching`
3. `component-creation`
4. `state-store-handling`
5. `validation-zod`
6. `useasync-customhook-creation`
7. `notifcation-container-pattern`
8. `theme-color-system`

## Acceptance Criteria

The skill refactor is complete when:

- No core skill teaches raw `fetch` as a valid default in web slices.
- Core skills explicitly reference the target FSD layer model.
- Core skills explicitly reference the shared error and API contracts.
- Optional skills are marked optional instead of pretending to be mandatory repo rules.
- The skills teach the target architecture rather than today's migration debt.
