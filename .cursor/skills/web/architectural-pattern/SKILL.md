---
name: architectural-pattern-web
description: Scope is apps/web (web frontend). Use when defining or refactoring web architecture in this repo. Prefer a common React module-based vertical slice structure with shallow ownership, a narrow `shared` layer, explicit rules for local, module, server, and app-wide state, and a single `app/store` home for zustand global stores. Trigger this skill for any architecture decision under `apps/web`.
---

# Architectural Pattern Web

> **Scope:** `apps/web` (web frontend). This skill applies only to code under `apps/web`.

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

1. `app` for startup, providers, router, shell wiring, and app-wide zustand stores
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
    store/
  pages/
    project-list/
      ProjectListPage.tsx
    project-workspace/
      ProjectWorkspacePage.tsx
    flow-editor/
      FlowEditorPage.tsx
    code-editor/
      CodeEditorPage.tsx
    task-editor/
      TaskEditorPage.tsx
    function-editor/
      FunctionEditorPage.tsx
    extension-editor/
      ExtensionEditorPage.tsx
    schema-editor/
      SchemaEditorPage.tsx
    view-editor/
      ViewEditorPage.tsx
  modules/
    project-management/
      ProjectManagementView.tsx
      ProjectApi.ts
      useProjectManagement.ts
    project-workspace/
      ProjectWorkspaceView.tsx
      WorkspaceApi.ts
      useProjectWorkspace.ts
      useProjectWorkspacePage.ts
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
If a store is truly global and implemented with `zustand`, place it in `src/app/store`, not in a top-level `src/stores` area.

## Pages vs Modules

`pages` and `modules` may reference the same business area, but only `pages` owns route files.

```text
pages/
  project-list/
    ProjectListPage.tsx

modules/
  project-management/
    ProjectManagementView.tsx
    useProjectManagement.ts
    ProjectApi.ts
```

- `pages/project-list/ProjectListPage.tsx` is the route boundary
- `modules/project-management/*` owns business UI, state, API calls, and orchestration
- Prefer a single explicit `PascalCase` page file such as `ProjectListPage.tsx` as the route entry inside each `pages/*` folder
- Do not add `pages/*/index.tsx` re-export wrappers just to shorten imports
- Import pages directly from their page file, for example `@pages/project-list/ProjectListPage`

## File Naming

Use one naming rule across `app`, `pages`, `modules`, and `shared`:

- Folders use `kebab-case`
- Files use `PascalCase`
- Utility/helper-style infrastructure files under areas such as `api`, `config`, or `lib` use a lowercase initial, for example `client.ts`, `env.ts`, `logger.ts`, `vNextErrorHelpers.ts`, or `responseHelpers.ts`

- Name files like exported React components or owned module contracts: `ProjectListActions.tsx`, `ProjectApi.ts`, `ProjectStore.ts`, `useProjectList.ts`, `Button.tsx`
- Keep the file name and the primary exported symbol aligned when practical
- Use the same rule for hooks in this repo, with one explicit exception: hook files and hook exports must use `use` + `PascalCase`, for example `useProjectList.ts` and `useProjectList`
- If a name starts with `use`, it must follow `use` + `PascalCase`. Do not use forms like `UseProjectList`, `use-project-list`, or `useprojectlist`
- When a name starts with the product prefix, write it as `vNext` at the start of the identifier, for example `vNextErrorHelpers.ts` or `vNextConfig.ts`. Do not start names with `Vnext` or `vnext`.
- If the product term appears after another word, keep normal casing for that position, for example `ErrorVnextHelper.ts`
- Keep folders descriptive and in `kebab-case`, such as `project-management`, `project-list`, `shared`, `ui`, or `code-editor`
- Keep framework exceptions as they are when required by tooling, for example `index.ts`, `main.tsx`, or `vite-env.d.ts`
- Do not use `camelCase` or `PascalCase` for folder names unless tooling forces it
- Do not mix `kebab-case`, `camelCase`, and `PascalCase` file names inside the same owner
- When renaming a file, update all import paths in the same change so ownership stays obvious and search remains reliable

## Ownership Rules

- `app` may import `pages`, `modules`, and `shared`.
- `pages` may import `modules` and `shared`.
- `modules` may import `shared`.
- `shared` imports only other `shared` code and package-level dependencies.
- `app/store` is the only valid home for app-wide `zustand` stores.
- Avoid module-to-module imports by default. Compose from `pages` or extract a stable generic contract into `shared`.
- If one module keeps reaching into another, merge them or redefine the boundary.
- Shape code around ownership, not around FSD-like layer completion.

## Module Design

Default module contents:

- `CodeEditorApi.ts`
- `CodeEditorStore.ts`
- `useCodeEditor.ts`
- `CodeEditorTypes.ts`
- `WorkflowValidationPanel.tsx`
- `ProjectManagementView.tsx`

Prefer flat colocated files first.
When the same kind of file grows past `3` inside one vertical slice, group that kind under a one-level folder.

Examples:

- If a module has more than `3` React components, move them under `components/`.
- If a module has more than `3` hooks, move them under `hooks/`.
- If a module has more than `3` API/service boundary files, move them under `api/`.
- If a module has more than `3` type-only files, move them under `types/`.
- Apply the same rule to other repeated file kinds only when the grouping improves scanning.

Keep the split shallow. The goal is easier scanning inside the owning vertical slice.

Allowed minimal split:

```text
modules/code-editor/
  components/
  api/
  CodeEditorStore.ts
  useCodeEditor.ts
```

- Do not create `model`, `ui`, `hooks`, `types`, or `services` folders by reflex.
- Create folders like `components`, `hooks`, `api`, or `types` only when the slice has more than `3` files of that kind or when a clear scanning problem already exists.
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
- All app-wide stores written with `zustand` live under `src/app/store`.
- Global state should stay rare and boring.
- `zustand` is for app-wide global state in this repo, not the default state tool for every module.
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

## project-management and project-workspace boundaries

Two slices touch the same BFF project surface. Do not collapse them into one shared `ProjectApi` under `shared`, and do not let either slice grow a second hidden transport owner.

### Transport ownership

- **`modules/project-management/ProjectApi.ts`**: Project lifecycle and project-scoped config against the BFF `projects` routes — for example list/create/import/delete project, fetch single `ProjectInfo`, read/write `vnext` workspace config, and config status used for project-level UX (wizard, diagnostics).
- **`modules/project-workspace/WorkspaceApi.ts`**: Active workspace file operations (`files` routes) **and** the project file tree from `GET projects/:id/tree` (e.g. `getProjectTree`). The tree is shell/workspace ownership even though the path lives under `projects` on the server.

Add new endpoints to the file whose **feature** owns the primary UX: tree and file-tree refresh stay with workspace; catalog and config CRUD stay with management.

### Hooks and orchestration

- **`useProjectWorkspacePage`** (bootstrap for the `/project/:id` workspace shell: parallel load of project row, tree, config status) lives under **`modules/project-workspace`**, not under `project-management`, because it orchestrates the workspace route.
- That hook may call **`ProjectApi`** for metadata and config status and **`WorkspaceApi`** for the tree. Prefer **`project-workspace` → `project-management`** for this pairing; avoid **`project-management` → `project-workspace`** imports for transport unless you are composing from `pages` or redesigning the boundary.

### App-wide store

- **`app/store`** may import module services (`WorkspaceApi`, `ProjectApi`) when the store is genuinely cross-shell. Example: refreshing the file tree calls `getProjectTree` from **`WorkspaceApi`**, not from `ProjectApi`.

### Types

- Cross-cutting DTOs such as `FileTreeNode` or `ProjectInfo` may stay in **`modules/project-management/ProjectTypes.ts`** until a real **`packages/*`** contract exists. `project-workspace` may import those types from `project-management` for shapes returned by workspace-facing calls; treat repeated type coupling as a signal to promote types into a shared package, not to merge API modules.

### Workspace Config Types

- Canonical workspace config types (`VnextWorkspaceConfig` and sub-types like `VnextWorkspacePaths`, `VnextWorkspaceExports`, `VnextWorkspaceExportsMeta`, `VnextWorkspaceDependencies`, `VnextWorkspaceReferenceResolution`) are defined in `@vnext-forge/vnext-types` and re-exported through `@vnext-forge/app-contracts`.
- Web code imports these types from `@vnext-forge/app-contracts`. The builder function `buildVnextWorkspaceConfig()` also lives there.
- `modules/project-management/ProjectTypes.ts` re-exports `VnextWorkspaceConfig` from `@vnext-forge/app-contracts` so module-local consumers can import from one place.
- Do not define duplicate workspace config interfaces in module-local or page-local code. Use the canonical types.
- Legacy names (`VnextWorkspaceConfigJson`, `VnextConfig`, `WorkspaceConfig`) are retired; always use `VnextWorkspaceConfig`.

### Workspace Config Types

- Canonical workspace config types (`VnextWorkspaceConfig` and sub-types like `VnextWorkspacePaths`, `VnextWorkspaceExports`, `VnextWorkspaceExportsMeta`, `VnextWorkspaceDependencies`, `VnextWorkspaceReferenceResolution`) are defined in `@vnext-forge/vnext-types` and re-exported through `@vnext-forge/app-contracts`.
- Web code imports these types from `@vnext-forge/app-contracts`. The builder function `buildVnextWorkspaceConfig()` also lives there.
- `modules/project-management/ProjectTypes.ts` re-exports `VnextWorkspaceConfig` from `@vnext-forge/app-contracts` so module-local consumers can import from one place.
- Do not define duplicate workspace config interfaces in module-local or page-local code. Use the canonical types.
- Legacy names (`VnextWorkspaceConfigJson`, `VnextConfig`, `WorkspaceConfig`) are retired; always use `VnextWorkspaceConfig`.

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
- Route entries should be explicit `PascalCase` page files such as `ProjectListPage.tsx` inside `pages/*`.
- Avoid `index.tsx` files in `pages/*` when they only re-export the real page component.

## Do

- Prefer `modules` as the default business boundary.
- Start flat and colocated; when one file kind grows past `3` in a slice, split it into a shallow folder for that kind.
- Keep `shared` generic and small.
- Keep request code in the owning module service.
- Expose scenario-named actions to UI instead of transport primitives.
- Keep server state, module state, and app-wide state separate.
- Promote state only when multiple real consumers require it.
- When state is promoted to a global `zustand` store, move it into `src/app/store` instead of leaving it under a module or creating `src/stores`.
- Use `useAsync` when reusable async lifecycle behavior is the point.
- Keep form schemas near the owner and runtime validation at the contract boundary.
- Keep reusable visual behavior in shared primitives and token sources.
- Keep notification infrastructure generic and notification decisions outside services.

## Do Not Do

- Do not create `entities`, `features`, `widgets`, `routes`, `stores`, `components`, or `hooks` as new top-level owners.
- Do not create slice-local subfolders too early; use them when repeated file kinds exceed `3`, not by reflex.
- Do not place `zustand` global stores inside modules or in a top-level `src/stores`; use `src/app/store`.
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
- a vertical slice has more than `3` files of one kind but still keeps them scattered at the slice root without a good reason
- `shared` contains business logic or business-shaped API wrappers
- a page owns transport, validation orchestration, or module workflow logic
- a `pages/*/index.tsx` file exists only to re-export a sibling page component
- a module or page mixes multiple file naming conventions without a tooling reason
- UI code calls `apiClient`, `callApi`, `unwrapApi`, or `fetch` directly
- a service invents a second error contract instead of `ApiResponse<T>` plus `VnextForgeError`
- branching depends on message text instead of `error.code`
- app-wide state was introduced for route-local state, request cache, or transient async flags
- a `zustand` global store lives outside `src/app/store`
- `useAsync` was added where a simple local flow would be clearer
- transport wrapping lives inside `useAsync` or an ad hoc hook instead of the owning service
- schemas are buried in JSX or durable validation rules are duplicated across screens
- services dispatch notifications or notifications store raw errors/domain objects
- shared primitives are bypassed with repeated local visual mappings that should be reusable
- project file tree or `getProjectTree` lives in `project-management/ProjectApi` instead of `project-workspace/WorkspaceApi`, or `project-management` imports workspace transport for bootstrap (prefer workspace owning the workspace-route hook and calling `ProjectApi` for metadata only)
