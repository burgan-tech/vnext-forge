# apps/web - Context

> **Scope:** `apps/web` (web frontend). Load with the repo-wide [`./CLAUDE.md`](./CLAUDE.md) whenever editing under `apps/web`. The app talks to the **active `apps/server` Hono REST backend** through the type-safe `hc<AppType>` client at `apps/web/src/shared/api/client.ts`; designer-ui modules use the package's transport-agnostic `ApiTransport` port, which `apps/web` registers via `HttpTransport` (REST). When editing **`packages/designer-ui`**, also load [`./CLAUDE.DESIGNER-UI.md`](./CLAUDE.DESIGNER-UI.md). **Skills:** web — [theme-color-system](./.cursor/skills/web/theme-color-system/SKILL.md), [icon-creation](./.cursor/skills/web/icon-creation/SKILL.md), [notification-container-pattern](./.cursor/skills/web/notification-container-pattern/SKILL.md); shared — [error-taxonomy](./.cursor/skills/shared/error-taxonomy/SKILL.md), [trace-headers](./.cursor/skills/shared/trace-headers/SKILL.md), [dependency-policy](./.cursor/skills/shared/dependency-policy/SKILL.md). Architecture, API access, routing, error handling, async flows, state, components, and forms below always apply here.

`apps/web` is the web client of vnext-forge. The standalone product framing belongs to the monorepo and product as a whole, not to `apps/web` as an isolated application.

## Goal

Build and evolve the web app as the primary workflow authoring interface. In the first phase, its main role is workflow design and code editing: project and workspace management, visual flow editing, component and code editors, and validation-oriented UX. It should not be framed as the place that boots or runs the external runtime.

## Architecture

The web app uses a simple module-based vertical slice structure. Do not use FSD terminology or add layers just to mirror a pattern.

### Owners

- `app` — providers, routes, layouts, and `app/store` (only valid home for app-wide `zustand` stores)
- `pages` — route boundary; wires the route and composes modules
- `modules` — business owner; holds screen content, module state, and module-local services
- `shared` — generic UI primitives, transport client, and cross-cutting helpers

### Ownership rules

- `app` may import `pages`, `modules`, and `shared`.
- `pages` may import `modules` and `shared`.
- `modules` may import `shared`.
- `shared` imports only other `shared` code and packages.
- Avoid module-to-module imports by default. Compose from `pages` or extract a stable generic contract into `shared`.
- `src/app`, `src/pages`, `src/modules`, and `src/shared` are the only intended top-level owners.
- Do not add new `src/entities`, `src/features`, `src/widgets`, `src/routes`, `src/stores`, `src/hooks`, or `src/components` owners.
- If a boundary is unclear, prefer `modules/*`.

### Module shape

Default module contents are flat:

```text
modules/project-management/
  ProjectManagementView.tsx
  ProjectApi.ts
  ProjectStore.ts
  useProjectManagement.ts
  ProjectTypes.ts
```

- Prefer flat colocated files first.
- When the same kind of file grows past **3** inside one slice (3+ components, 3+ hooks, 3+ API files, 3+ type files), group that kind under a one-level folder (`components/`, `hooks/`, `api/`, `types/`).
- Keep splits shallow. Do not create `model`, `ui`, `hooks`, `services` folders by reflex.
- Expose one obvious outside entry point. Use `index.ts` only when it clarifies the boundary — never just to forward a single direct export.

### Pages vs modules

- `pages/project-list/ProjectListPage.tsx` is the route boundary.
- `modules/project-management/*` is the business owner.
- Use page naming only in `pages/*`. Inside `modules/*`, prefer names such as `*View.tsx`, `*Panel.tsx`, or `*Section.tsx`.
- Do not add `pages/*/index.tsx` re-export wrappers.
- Pages should not own transport, store, or workflow orchestration directly.

### Active module owners

`project-management`, `project-workspace`, `canvas-interaction`, `code-editor`, `workflow-validation`, `workflow-execution`, `save-workflow`, `save-component`, `task-editor`, `function-editor`, `extension-editor`, `schema-editor`, `view-editor`.

### `project-management` ↔ `project-workspace` boundary

Two slices touch the same project surface. Do not collapse them into one shared `ProjectApi` under `shared`.

- **`modules/project-management/ProjectApi.ts`** — Project lifecycle and project-scoped config: list/create/import/delete project, fetch single `ProjectInfo`, read/write workspace config, config status used for project-level UX.
- **`modules/project-workspace/WorkspaceApi.ts`** — Active workspace file operations and the project file tree (`getProjectTree`). The tree is workspace ownership even though the path lives under `projects` on the server.
- `useProjectWorkspacePage` (workspace-shell bootstrap) lives under `modules/project-workspace`. It may call `ProjectApi` for metadata and `WorkspaceApi` for the tree.
- `app/store` may import module services (`WorkspaceApi`, `ProjectApi`) when the store is genuinely cross-shell. Refreshing the file tree calls `getProjectTree` from `WorkspaceApi`, not from `ProjectApi`.

## File Naming

- Folders use `kebab-case`.
- React components and module contracts use `PascalCase` (`ProjectManagementView.tsx`, `ProjectApi.ts`, `ProjectStore.ts`).
- Hook files and hook exports use `use` + `PascalCase` (`useProjectList.ts` exports `useProjectList`).
- Utility/helper-style infrastructure files under `api`, `config`, or `lib` start with a lowercase letter (`client.ts`, `env.ts`, `logger.ts`, `vNextErrorHelpers.ts`).
- When a file name starts with the product prefix, write `vNext` (not `Vnext` or `vnext`). If `vnext` appears later in the name, keep normal word casing for that position (`ErrorVnextHelper.ts`).
- Framework exceptions stay (`index.ts`, `main.tsx`, `vite-env.d.ts`).
- Do not mix `kebab-case`, `camelCase`, and `PascalCase` file names inside the same owner.

## Cross-package imports

| Constraint | Rule |
|------------|------|
| `@vnext-forge/services-core` | **Do not import** from `apps/web` (no deep paths). |
| `@vnext-forge/designer-ui/dist/**` | **Do not import.** Use `@vnext-forge/designer-ui` or `@vnext-forge/designer-ui/editor`. |
| `@vnext-forge/server` | **Type-only** imports allowed **only** in `apps/web/src/shared/api/**` (specifically `client.ts` for `AppType`). No runtime imports — see [ADR 007](./docs/architecture/adr/007-rest-migration.md). |

Enforced by `apps/web/eslint.config.js` (`no-restricted-imports`, narrowed for the `shared/api/**` exception). Full policy: [`.cursor/skills/shared/dependency-policy/SKILL.md`](./.cursor/skills/shared/dependency-policy/SKILL.md), [`docs/architecture/dependency-policy.md`](./docs/architecture/dependency-policy.md).

## Workspace Config Types

- Canonical workspace config types (`VnextWorkspaceConfig`, `VnextWorkspacePaths`, `VnextWorkspaceExports`, `VnextWorkspaceExportsMeta`, `VnextWorkspaceDependencies`, `VnextWorkspaceReferenceResolution`) are defined in `@vnext-forge/vnext-types` and re-exported through `@vnext-forge/app-contracts`.
- Web code imports these types from `@vnext-forge/app-contracts`. The `buildVnextWorkspaceConfig()` builder also lives there.
- `modules/project-management/ProjectTypes.ts` re-exports `VnextWorkspaceConfig`; module-local consumers can import from one place.
- Do not define duplicate workspace config interfaces in module-local or page-local code.
- Legacy names (`VnextWorkspaceConfigJson`, `VnextConfig`, `WorkspaceConfig`) are retired; always use `VnextWorkspaceConfig`.

## API Access

All server communication goes through the type-safe Hono client `apiClient = hc<AppType>(...)` in `shared/api/client.ts`. The client's **base URL** comes from the **per-shell config singleton**, not a hardcoded origin. The client wraps fetch with `createTraceInjectingFetch()` so every outbound request carries `X-Trace-Id` and W3C `traceparent` headers (see [ADR 002](./docs/architecture/adr/002-trace-headers.md)).

**Wire shape per method** is defined once in `@vnext-forge/app-contracts/method-http.ts` (`METHOD_HTTP_METADATA` / `getMethodHttpSpec`) and consumed by both the server route registration and the web `HttpTransport` adapter (`apps/web/src/transport/HttpTransport.ts`) used by `designer-ui`.

**Bootstrap:** load initial workspace-shaped data via **`projects.getWorkspaceBootstrap`** once where the product needs aggregation — see [ADR 004](./docs/architecture/adr/004-bootstrap-aggregation.md). **Do not** fan out multiple parallel "initial load" calls for the same aggregated payload.

The intended call chain is:

```text
shared/api/client.ts (apiClient = hc<AppType>(...))
  -> owning service module under apps/web/src/services/<domain>.service.ts
     (or module-local *Api.ts that delegates to one of those services)
  -> module hook or action
  -> UI
```

### Helpers

```ts
// For useAsync; returns ApiResponse<T>; validates envelope shape
callApi<T>(response: Response | Promise<Response>): Promise<ApiResponse<T>>

// For imperative use outside useAsync; throws VnextForgeError on failure
unwrapApi<T>(response: Response | Promise<Response>, fallbackMessage?: string): Promise<T>
```

Both helpers route through `shared/api/api-envelope.ts` for response shape validation and `shared/lib/error/vNextErrorHelpers.ts` for `VnextForgeError` normalization.

### Rules

- Do not call `apiClient` directly from pages, components, hooks, or JSX.
- Keep direct `apiClient` calls in the owning service module (`apps/web/src/services/*` or a thin module-local `*Api.ts` facade).
- `callApi` and `unwrapApi` should appear only in `shared/api`, `apps/web/src/services/*`, or the owning module service boundary.
- Only lift service code into `shared/*` when it is truly generic and stable across modules.
- Do not use raw `fetch` anywhere in the web app.
- Service functions return `Promise<ApiResponse<T>>` for normal flows.
- Name service functions by business intent (`list`, `create`, `getWorkspaceBootstrap`), not HTTP verbs alone.
- Use response helpers from `@vnext-forge/app-contracts` (`isSuccess`, `isFailure`, `fold`, `getData`, `getError`, `unwrap`, `unwrapOr`) for branching.
- Type-only imports from `@vnext-forge/server` are allowed **only** under `shared/api/**` (specifically `client.ts` for the `AppType` Hono `hc` typing) — see [ADR 007](./docs/architecture/adr/007-rest-migration.md). Runtime imports from the server are forbidden.

### Default service pattern

```ts
// apps/web/src/services/projects.service.ts
import { apiClient, callApi } from '@shared/api/client';
import type { ApiResponse } from '@vnext-forge/app-contracts';

export const projectsService = {
  list(): Promise<ApiResponse<ProjectInfo[]>> {
    return callApi<ProjectInfo[]>(apiClient.api.v1.projects.list.$get());
  },
  create(input: CreateProjectInput): Promise<ApiResponse<ProjectInfo>> {
    return callApi<ProjectInfo>(apiClient.api.v1.projects.create.$post({ json: input }));
  },
};
```

Module-local `*Api.ts` files (e.g. `modules/project-management/ProjectApi.ts`) act as thin facades over these services and preserve the module's external API. Hooks and actions consume the service; `callApi` wrapping stays inside the service and the hook never touches `apiClient` or `callApi` directly.

## Routing, Suspense, Error boundary

- Lazy routes sit under a single **`<Suspense fallback={<RouteSkeleton />}>`** around `<Routes>` (`src/app/RouteSkeleton.tsx`).
- **`RouteErrorBoundary`** (`src/app/RouteErrorBoundary.tsx`) wraps the layout: it **logs** the error and surfaces **`traceId`** for support.

**App shell split (sidebar / main):** use `@vnext-forge/designer-ui/ui` `Resizable*`; follow **`CLAUDE.DESIGNER-UI.md`** (§ Resizable) and **theme-color-system** split-pane + *designer-ui Resizable* invariants (thin handle, `disableCursor`, optional `autoCollapseBelowMin` / `collapseOvershootPx`).

## Async UI Flows

Use the shared `useAsync` hook (`shared/hooks/useAsync.ts`) for reusable async UI contracts.

### Contract

```ts
type AsyncFunction<T, TArgs extends unknown[]> =
  (...args: TArgs) => Promise<ApiResponse<T>>;

useAsync(asyncFunction, options?) -> { execute, retry, reset, loading, error, data, success }
```

- `execute(...args)` triggers the async call and updates loading, error, data, success.
- `retry()` re-runs with the last arguments.
- `reset()` clears all state.
- `error` is always `VnextForgeError | null`.
- `data` is always `T | null`.

### Rules

- Pass owning service functions into `useAsync`; they must return `Promise<ApiResponse<T>>`.
- `useAsync` normalizes failures to `VnextForgeError` automatically.
- Use `options.onSuccess` / `options.onError` for side effects (navigation, notifications); keep these out of services.
- Never call `apiClient` or `callApi` directly inside `useAsync` or a custom hook — the transport wrapping belongs in the owning service module.
- Do not invent a second async primitive alongside `useAsync`.

### Use `useAsync` when

- One module flow needs reusable loading and error handling.
- The UI needs derived booleans or scenario-named actions.
- Multiple consumers need the same async lifecycle semantics.

### Keep it simpler when

- One component can express the flow clearly with local state.
- The request is one-off and does not need reusable retry or error semantics.

## Save shortcut (R-f15)

- **Do not** add document-level **`Ctrl+S` / `Meta+S`** `keydown` handlers in `apps/web`.
- Register the web shell’s single save sink through designer-ui **`useRegisterGlobalSaveShortcut`** / `globalSaveShortcutRegistry` (see [`./CLAUDE.DESIGNER-UI.md`](./CLAUDE.DESIGNER-UI.md)).

## Notifications (R-f16)

- **One** notification sink per shell on web: **Sonner**, wired through the designer-ui **notification port** — do **not** toast directly from ad hoc `sonner` calls in feature code.
- **`useProjectWorkspace`** and similar flows: **dedupe** — at most **one** toast per mutation. Parity with extension: [`docs/architecture/web-extension-parity.md`](./docs/architecture/web-extension-parity.md), [`.cursor/skills/web/notification-container-pattern/SKILL.md`](./.cursor/skills/web/notification-container-pattern/SKILL.md).

## Error Handling

Full contract: [`.cursor/skills/shared/error-taxonomy/SKILL.md`](./.cursor/skills/shared/error-taxonomy/SKILL.md), [ADR 005](./docs/architecture/adr/005-error-taxonomy.md). **`traceId`** on failures follows [ADR 002](./docs/architecture/adr/002-trace-headers.md) (`ApiFailure` correlation).

The shared error type is `VnextForgeError` from `@vnext-forge/app-contracts`.

Key fields:

- `code: ErrorCode` — stable machine-readable identifier (`FILE_*`, `PROJECT_*`, `WORKFLOW_*`, `RUNTIME_*`, `SIMULATION_*`, `GIT_*`, `API_*`, `INTERNAL_*`).
- `context.layer: ErrorLayer` — where the error originated.
- `context.source` — which function threw.
- `traceId` — correlation ID; preserve it always.
- `toUserMessage()` — safe string for UI.
- `toLogEntry()` — structured log payload.

### Error flow

```text
Hono RPC Response
  -> callApi<T>()        (shared/api/client.ts) normalizes network/parse failures
  -> owning service      returns ApiResponse<T>, no throw on normal failure branch
  -> useAsync            converts ApiFailure into VnextForgeError, sets error state
  -> UI                  renders error.toUserMessage().message
```

### Rules

- Use `error.toUserMessage().message` in UI; never raw `error.message`.
- Use `error.code` to branch behavior; never branch on `message.includes(...)`.
- Preserve `traceId` whenever the backend provides one.
- Do not return raw `Error`, raw HTTP responses, or raw backend payloads to components.
- Do not create per-feature error classes for ordinary API failures.
- Do not store a second UI-only error object when `VnextForgeError` already exists.
- Do not make components aware of status codes, fetch exceptions, or RPC internals.

### Adding a new error type

1. Add the code to `@vnext-forge/app-contracts`.
2. Normalize it in the server or transport boundary where the failure is first understood.
3. Branch on `error.code` in the module only if behavior must differ.
4. Keep presentation text flowing through `toUserMessage()`.

## State Placement

### Decision order

1. Who reads this state.
2. How long it must live.
3. Which module or page owns the decision.
4. Whether it must survive navigation or reload.

### Default owners

- **Component state** — drafts, modal flags, active tab, hover, one-view loading, one-off async flows.
- **Module hook / module store** — route-local or flow-local async and UI state. Prefer plain state, then custom hook, then module store.
- **Server state** — fetched backend data. Keep query keys and request functions near the owning module.
- **App-wide state** — auth/session, active workspace reused across shell, theme/layout preferences, notification center, feature flags.

### Rules

- All app-wide stores written with `zustand` live under `src/app/store`.
- Global state should stay rare and boring.
- Do not mirror query cache into a global store without a concrete reason.
- Do not use global stores for route-local async state, request cache, or raw API failures.
- Do not recreate top-level `src/stores/*` for new web state.
- Promote state only when multiple real consumers require it.
- Do not split a small module into `model`, `hooks`, `types` folders unless navigation has actually become hard.
- Move only durable results upward, not transient loading or error flags.
- **Zustand:** use **selector functions** — `useStore((s) => s.field)`; do **not** subscribe to the **entire store** unless every field is required (R-f11).

### Repo-specific owners

- `modules/project-management/*` — project list, create, import, delete, related selection state.
- `modules/project-workspace/*` — active workspace, file tree, active file, workspace coordination.
- `modules/code-editor/*` — editor-facing file content, editor bridge, save coordination.
- `modules/canvas-interaction/*` — workflow canvas, selection, diagram interaction.
- `modules/workflow-validation/*` — diagnostics, validation feedback, validation panel.
- `modules/workflow-execution/*` — runtime execution and simulator-facing state.
- `app/*` — true shell-wide state only (providers, route wiring, rare cross-route preferences).

## Component Creation

All new UI implementation must use Tailwind CSS utilities. Do not introduce CSS modules, styled-components, or other component-local styling systems for new component work.

### Placement

- `shared/ui` — generic, domain-agnostic UI primitives.
- `modules` — user-facing behavior, UI, hooks, state, and service modules owned by one business area.
- `pages` — route-level assembly only.
- `app` — providers, router, global setup.

### Rules

- Reuse an existing component before creating a new one. Check `shared/ui` first.
- If a component already exists in `shared/ui`, use that implementation instead of duplicating elsewhere.
- Do not create `index.ts` files just to re-export a single directly usable file.
- Keep `apiClient`, `callApi`, and `unwrapApi` usage out of JSX.
- Do not place transport calls directly in page components or view components.
- Build new component styling with Tailwind utility classes.
- During migration, move callers to the new owner directly instead of leaving backward-compat wrapper files.
- **Monaco / editor-related** UI: import from **`@vnext-forge/designer-ui/editor`**, not the package root. New `package.json#exports` subpaths follow [`docs/architecture/bundler-checklist.md`](./docs/architecture/bundler-checklist.md).

### Default variants

- `default` is the baseline primary variant for general UI; opt into other families only for clear semantic reasons.
- `success` is the reusable positive-semantic family (selected states, affirmative outcomes).
- `muted` is the reusable passive-semantic family (empty states, no-data shells, low-emphasis support regions).

### `shared/ui` interaction defaults

- Hover should follow interactivity. Non-clickable surfaces default to `hoverable={false}`; clickable descendants (buttons, triggers, menu items, links, checkbox controls) keep hover enabled.
- Clickable descendants must be visually separable in the resting state. Do not rely on hover as the first or only affordance.

For deeper visual-system rules (token families, semantic coloring, elevation, motion, z-index, badge, table, drag, split-pane, form, toast), see `.cursor/skills/web/theme-color-system/SKILL.md`.

## Form Validation

Use `React Hook Form` and `Zod` for form-facing validation.

### Ownership

- Web form layer owns field-level UX, correction flow, and submit readiness.
- `@vnext-forge/app-contracts` and `@vnext-forge/vnext-types` own shared cross-app contracts.
- Module-local schemas own web-only validation behavior by default.
- API or adapter boundaries own response and payload trust checks.

### Rules

- Define form schemas near the owning module by default.
- Lift a schema into `shared/*` only when the rule is genuinely reused and stays generic.
- Reuse shared package schemas only when they represent real cross-app contracts.
- Validate transformed payloads before sending them.
- Validate external data before trusting it in modules or shared adapters.
- Keep user-facing validation messages separate from technical diagnostics.
- Do not define inline schemas inside JSX by default.
- Do not duplicate the same domain contract in multiple web slices.
- Do not assume TypeScript types replace runtime validation.
- Do not leak raw Zod internals into UI branching.
- Do not use one giant schema for form UX, transport, persistence, and response parsing at once.

### Decision rule

Is this rule about user correction, or about runtime trust?

- User correction → keep it in the web form layer.
- Runtime trust or cross-app contract → move it to the shared package or app boundary that owns the contract.

## Logging

- Do not use raw `console.log`, `console.info`, `console.warn`, or `console.error` in application code.
- Use the shared logger under `@shared/lib/logger`.
- Create a scoped logger with `createLogger('ScopeName')` once per module or component boundary and reuse that instance for all log calls.
- Do not call `createLogger(...)` inside hot paths or before every `debug`, `info`, `warn`, or `error` call.
- Direct `console.*` usage is reserved for the shared logger implementation only.
- **Webview shell:** the extension injects **`window.__VNEXT_CONFIG__`** for environment hints; read it only through the **per-shell config module**, not scattered `window` access in features.

## Specialized Skills

Narrow visual / UI infrastructure: `.cursor/skills/web/*` (linked in **Scope**). Cross-cutting **shared** skills are also linked in **Scope**. Everything else in this file applies to all `apps/web` edits regardless of skill triggers.

## Expectation

When working in `apps/web`, optimize for a maintainable product-facing web client: strong UX, explicit ownership, predictable state, local responsibility where the code is web-only, and architecture-safe incremental migration.
