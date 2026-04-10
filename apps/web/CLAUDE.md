# apps/web - Context

`apps/web` is the web client of vnext-forge. The standalone product framing belongs to the monorepo and product as a whole, not to `apps/web` as an isolated application.

## Goal

Build and evolve the web app as the primary workflow authoring interface. In the first phase, its main role is workflow design and code editing: project and workspace management, visual flow editing, component and code editors, and validation-oriented UX. It should not be framed as the place that boots or runs the external runtime.

## Direction

The web app uses a simple module-based vertical slice structure. Do not use FSD terminology or add layers just to mirror a pattern.

Default to:

- `app` for providers, routes, and global setup
- `pages` for route assembly
- `modules` for user-facing business behavior, UI, state, and service modules
- `shared` for generic UI primitives and cross-cutting helpers

The current migration target is already active:

- `src/app`, `src/pages`, `src/modules`, and `src/shared` are the only intended top-level owners
- do not add new `src/entities`, `src/features`, `src/widgets`, `src/routes`, `src/stores`, `src/hooks`, or `src/components` owners
- if a boundary is unclear, prefer `modules/*`

Keep the pattern simple:

- `pages` is the route boundary; it wires the route and composes modules
- `modules` is the business owner; it holds the actual screen content, state, and module-local services
- do not create `model`, `ui`, `hooks`, or `types` subfolders unless the slice has grown enough to justify them
- prefer shallow, colocated files inside the owning folder
- if unsure, choose `modules`

The detailed architecture rules live in `apps/web/.agents/skills/architectural-pattern/SKILL.md`. Keep this file shorter and more operational.

Prefer extracting durable logic either into the remaining shared packages (`@vnext-forge/types`, `@vnext-forge/app-contracts`) or into well-bounded local module owners under `src/modules/*` instead of expanding page-level or route-level coupling.
Prefer extracting durable logic into the active module owners instead of reviving legacy top-level areas. Current primary owners include `project-management`, `project-workspace`, `canvas-interaction`, `code-editor`, `workflow-validation`, `workflow-execution`, `save-workflow`, `save-component`, `task-editor`, `function-editor`, `extension-editor`, `schema-editor`, and `view-editor`.

## Expectation

When working in `apps/web`, optimize for a maintainable product-facing web client: strong UX, explicit ownership, predictable state, local responsibility where the code is web-only, and architecture-safe incremental migration.

## Rules

Detailed implementation rules, slice constraints, and architecture-specific conventions should be referenced from dedicated rule documents once finalized.

- If a component is needed, check `shared/ui` first and use it from there when it already exists.
- In `shared/ui`, hover should follow interactivity. Non-clickable surfaces default to `hoverable={false}` unless explicitly requested; clickable descendants such as buttons, triggers, menu items, links, and checkbox controls may keep hover enabled.
- Do not create `index.ts` files only to forward a single direct export. Prefer importing the concrete file when the path is already clear.
- During migration, do not keep route-level or legacy wrapper and re-export files for backward compatibility unless there is an explicit technical requirement for a staged migration.
- When updating a structure, complete the migration fully. Do not leave backward-looking files behind after the new owner is in place.
- Do not keep wrapper files whose only job is to re-export another file, such as `export { ProjectListHero } from './project-list-hero/ui/project-list-hero';`.
- Do not create a second business owner under `pages`. A route entry may compose `modules/project-management/*`, but it should not duplicate that module with another business owner.
- Route entries should compose current owners such as `modules/project-management/*` or `modules/project-workspace/*`; pages should not own transport, store, or workflow orchestration directly.
- Use page naming only in `pages/*`. Inside `modules/*`, prefer names such as `*.view.tsx`, `*.panel.tsx`, or `*.section.tsx`.

## API Access

All server communication goes through the Hono RPC client in `shared/api/client.ts`.

The intended call chain is:

```text
shared/api/client.ts
  -> owning service module (usually module-local, returns Promise<ApiResponse<T>>)
  -> module hook or action
  -> UI
```

- `callApi<T>(response)` converts a Hono RPC `Response` to `Promise<ApiResponse<T>>`. Use it inside the owning service module.
- `unwrapApi<T>(response)` throws `VnextForgeError` on failure and returns `T` directly. Use it for imperative flows outside `useAsync`.
- Do not call `apiClient` directly from pages, components, hooks, or JSX.
- Keep direct `apiClient` calls in the owning service module, usually inside the module that owns the workflow.
- Only lift service code into `shared/*` when that logic is truly generic and stable across modules.
- Do not use raw `fetch` anywhere in the web app.
- Legacy `entities/*/api` placement is obsolete; keep project and workspace endpoint access in module-owned service files.

## Async UI Flows

Use the shared `useAsync` hook (`shared/hooks/useAsync.ts`) for reusable async UI contracts.

- Pass owning service functions into `useAsync`; they should return `Promise<ApiResponse<T>>`.
- `useAsync` normalizes failures to `VnextForgeError` automatically.
- Use `options.onSuccess` and `options.onError` for side effects like navigation or notifications; keep these out of services.
- Do not invent a second async primitive alongside `useAsync`.

## Error Handling

- All errors are `VnextForgeError` from `@vnext-forge/app-contracts`.
- Use `error.toUserMessage().message` in UI; never raw `error.message`.
- Use `error.code` to branch behavior; never branch on message strings.
- `traceId` must be preserved when present.

## Logging

- In `apps/web`, do not use raw `console.log`, `console.info`, `console.warn`, or `console.error` in application code.
- Use the shared logger under `@shared/lib/logger` instead.
- Create a scoped logger with `createLogger('ScopeName')` once per module or component boundary and reuse that instance for all log calls.
- Do not call `createLogger(...)` inside hot paths or before every `debug`, `info`, `warn`, or `error` call.
- Direct `console.*` usage is reserved for the shared logger implementation only.
