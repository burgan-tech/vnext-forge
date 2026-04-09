---
name: architectural-pattern-web
description: Use when defining or refactoring web architecture in this repo without FSD. Prefer a common React module-based vertical slice structure with shallow ownership, a narrow `shared` layer, and explicit rules for local, module, server, and app-wide state.
---

# Architectural Pattern Web

Use this skill for web structure decisions and architecture reviews.

Related skills:
- `api-fetching` for transport details
- `api-error-handling` for failure normalization
- `state-store-handling` for state placement nuance
- `async-feature-flow` for `useAsync`
- `validation-zod` for form/runtime validation
- `notification-feedback` for optional transient feedback
- `theme-color-system` for token and primitive ownership

## Core Rule

Use the narrowest owner that matches the concern:

1. `app` for startup, providers, router, shell wiring
2. `pages` for route entry and route composition
3. `modules` for business UI, state, services, async flows
4. `shared` for generic, stable, cross-module infrastructure

If unsure, choose `modules`.

## Target Shape

```text
src/
  app/
    providers/
    routes/
    layouts/
  pages/
    project-list/
      index.tsx
    project-workspace/
      index.tsx
    flow-editor/
      index.tsx
    code-editor/
      index.tsx
    task-editor/
      index.tsx
    function-editor/
      index.tsx
    extension-editor/
      index.tsx
    schema-editor/
      index.tsx
    view-editor/
      index.tsx
  modules/
    project-management/
      project-management.view.tsx
      project-api.ts
      use-project-management.ts
    project-workspace/
      project-workspace.view.tsx
      workspace-api.ts
      use-project-workspace.ts
    canvas-interaction/
    code-editor/
    workflow-validation/
    workflow-execution/
    save-workflow/
    save-component/
    task-editor/
    function-editor/
    extension-editor/
    schema-editor/
    view-editor/
  shared/
    api/
    ui/
    lib/
    config/
```

Active target owners are `src/app`, `src/pages`, `src/modules`, `src/shared`.
Do not extend legacy top-level owners such as `entities`, `features`, `widgets`, `routes`, `stores`, `components`, or `hooks`.

## Pages vs Modules

`pages` and `modules` may reference the same business area, but only `pages` owns route files.

```text
pages/
  project-list/
    index.tsx

modules/
  project-management/
    project-management.view.tsx
    use-project-management.ts
    project-api.ts
```

- `pages/project-list/index.tsx` is the route boundary
- `modules/project-management/*` owns business UI, state, API calls, and orchestration
- Reserve `*.page.tsx` for `pages/*` only

## Ownership Rules

- `app` may import `pages`, `modules`, and `shared`.
- `pages` may import `modules` and `shared`.
- `modules` may import `shared`.
- `shared` imports only other `shared` code and package-level dependencies.
- Avoid module-to-module imports by default. Compose from `pages` or extract a stable generic contract into `shared`.
- If one module keeps reaching into another, merge them or redefine the boundary.
- Shape code around ownership, not around FSD-like layer completion.

## Module Design

Default module contents:

- `code-editor.api.ts`
- `code-editor.store.ts`
- `use-code-editor.ts`
- `code-editor.types.ts`
- `workflow-validation.panel.tsx`
- `project-management.view.tsx`

Prefer flat colocated files first. Add one-level subfolders only when scanning the module becomes genuinely hard.

Allowed minimal split:

```text
modules/code-editor/
  components/
  api/
  code-editor.store.ts
  use-code-editor.ts
```

- Do not create `model`, `ui`, `hooks`, `types`, or `services` folders by reflex.
- Do not create deep trees unless the module is genuinely large.
- Expose one obvious outside entry point. Use `index.ts` only when it clarifies the boundary.

## Shared Layer

Put code in `shared` only when it is generic, stable, and useful across multiple modules.

Good fits:

- transport client and HTTP helpers in `shared/api`
- design-system primitives in `shared/ui`
- pure helpers in `shared/lib`
- app-wide config and constants in `shared/config`
- optional notification infrastructure that stays generic and ephemeral
- durable cross-module contracts already shared through `packages/*`

Bad fits:

- module-specific API calls
- business workflows
- module-owned state
- nearby helpers that should stay colocated
- business-specific notification logic
- page- or module-specific visual mappings

If `shared` starts changing because one module changed, it probably is not shared.

## Shared UI Ownership

- `shared/ui` owns reusable primitives, semantic variants, and token-backed interaction behavior.
- `pages` and `modules` may choose variants and layout, but should not keep redefining the same primitive contract with raw Tailwind mappings.
- If a visual rule is reused across distant modules, move it to `shared/ui` or the shared token layer.
- Do not turn a structural refactor into a forced theme redesign unless the task is explicitly visual-system work.

## State Placement

- Local state: drafts, modal flags, active tab, hover, one-view loading, one-off async flows.
- Server state: fetched backend data. Keep query keys and request functions near the owning module. Do not mirror query cache into a global store without a concrete reason.
- Module state: shared client state used by several components in one business area. Prefer plain state, then custom hook, then module store.
- App-wide state: auth/session, active workspace reused across shell, theme/layout preferences, optional notification center, feature flags.
- Global state should stay rare and boring.
- Do not use global stores for route-local async state, request cache, or raw API failures.
- Use `useAsync` only when a module needs a reusable async contract such as `loading`, `error`, `retry`, or scenario-shaped actions.

## API and Error Boundaries

- `shared/api/client.ts` owns transport setup and the typed Hono RPC client.
- Normal flow: `shared/api/client.ts -> module service -> module hook/action -> UI`
- `apiClient`, `callApi`, and `unwrapApi` should appear only in `shared/api` or in the owning module service boundary.
- `pages`, JSX, presentational components, and ad hoc hooks must not own transport.
- Module-local endpoint access is the default. Do not add new `entities/*/api` style placement.
- Services should return `Promise<ApiResponse<T>>` for normal async flows.
- `unwrapApi` is the imperative path and returns `T` or throws `VnextForgeError`.
- `VnextForgeError` is the shared web failure contract.
- Do not invent a second error shape for normal failures.
- Branch on `error.code`, never on `message.includes(...)`.
- UI must not see raw transport errors, raw backend payloads, raw `ApiFailure`, or raw `error.message`.
- Render `error.toUserMessage().message` in UI.

## Validation Placement

- Use `React Hook Form` + `Zod` for form-facing validation in the owning page or module.
- Keep form schemas outside JSX and near the owner.
- Runtime trust checks belong to the package, API, adapter, or boundary that owns the contract.
- Reuse shared package schemas only for real cross-app contracts.
- Do not duplicate durable contract schemas across multiple screens.
- Resolve validation failures into the shared error contract before they affect broader flows.

## Notification Placement

- Notifications are optional and transient.
- Prefer inline validation or inline error UI when the issue belongs to the current screen.
- Services do not emit notifications.
- Triggering belongs to module or page orchestration.
- Rendering belongs to shared notification infrastructure if such infrastructure exists.
- Keep notification payloads user-facing and minimal. Do not store raw errors or domain objects in them.

## Routing

- Keep pages thin: route params, composition, layout.
- Business logic, transport, validation orchestration, and module state stay in `modules`.
- Route entries may be `index.tsx` or `*.page.tsx`, but page files stay inside `pages`.

## Do

- Prefer `modules` as the default business boundary.
- Start flat and colocated; split only when navigation gets worse.
- Keep `shared` generic and small.
- Keep request code in the owning module service.
- Expose scenario-named actions to UI instead of transport primitives.
- Keep server state, module state, and app-wide state separate.
- Promote state only when multiple real consumers require it.
- Use `useAsync` when reusable async lifecycle behavior is the point.
- Keep form schemas near the owner and runtime validation at the contract boundary.
- Keep reusable visual behavior in shared primitives and token sources.
- Keep notification infrastructure generic and notification decisions outside services.

## Do Not Do

- Do not reintroduce FSD layers under different names.
- Do not create `entities`, `features`, `widgets`, `routes`, `stores`, `components`, or `hooks` as new top-level owners.
- Do not move module-specific code into `shared` for convenience.
- Do not let pages become transport owners or hidden business layers.
- Do not use raw `fetch`, raw `Response`, raw backend payloads, or raw `ApiFailure` in UI code.
- Do not show raw `error.message` in UI.
- Do not invent ad hoc error contracts for normal API failures.
- Do not mirror query cache into a global store without a concrete reason.
- Do not create global stores for route-local async or view state.
- Do not call `apiClient` or `callApi` directly inside JSX, `useAsync`, or ad hoc hooks.
- Do not define inline Zod schemas inside JSX by default.
- Do not use notifications instead of proper inline screen state.
- Do not bypass shared primitives with repeated slice-local Tailwind mappings when the rule is reusable.

## Review Standard

Raise a concern when:

- a module was split into artificial layers without ownership gain
- `shared` contains business logic or business-shaped API wrappers
- a page owns transport, validation orchestration, or module workflow logic
- UI code calls `apiClient`, `callApi`, `unwrapApi`, or `fetch` directly
- a service invents a second error contract instead of `ApiResponse<T>` plus `VnextForgeError`
- branching depends on message text instead of `error.code`
- app-wide state was introduced for route-local state, request cache, or transient async flags
- `useAsync` was added where a simple local flow would be clearer
- transport wrapping lives inside `useAsync` or an ad hoc hook instead of the owning service
- schemas are buried in JSX or durable validation rules are duplicated across screens
- services dispatch notifications or notifications store raw errors/domain objects
- shared primitives are bypassed with repeated local visual mappings that should be reusable
