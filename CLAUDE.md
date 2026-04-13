# vnext-forge - Project Context

Visual workflow designer: React Flow canvas + Monaco code editor. Monorepo with pnpm workspaces + Turborepo.

## Project Goal

The main purpose of this project is to provide the **standalone UI** for a workflow engine runtime application. It acts as the frontend surface for another application domain, but it is intentionally built and delivered as an independent product.

The UI is not limited to workflow visualization. It is responsible for the end-to-end management of workflow definitions described in JSON, including creating workflows through the interface, editing them, validating workflow definitions, validating workflow data, running tests and simulations, and supporting other runtime-related workflow operations from the UI.

In short, the product is meant to be a standalone design and management interface for the workflow engine ecosystem, focused on authoring, verification, and operational workflow tooling.

---

### Shared Packages

#### `packages/vnext-types` -> `@vnext-forge/types`

Domain model types. Workflow, State, Transition, Task, Schema, View, Function, Extension, Diagram, and Config types, plus constants (state-types, trigger-types, task-types) and utilities (csx-codec, version).

- Depends on no other package (leaf node)
- Used by both `apps/web` and `apps/server`

---

#### `packages/app-contracts` -> `@vnext-forge/app-contracts`

Web <-> Server communication contracts. Two responsibilities:

**1. ApiResponse<T>** (`response/envelope.ts`):

```ts
ApiSuccess<T>  -> { success: true; data: T }
ApiFailure     -> { success: false; error: { code, message, traceId } }
```

All server endpoints are wrapped in this envelope. The web layer performs a discriminated union check via `response.success`.

**2. VnextForgeError** (`error/vnext-error.ts`):
The shared error type used across all application layers. Every `throw` should be a `VnextForgeError`.

- `code: ErrorCode` - `FILE_*`, `PROJECT_*`, `WORKFLOW_*`, `RUNTIME_*`, `SIMULATION_*`, `GIT_*`, `API_*`, `INTERNAL_*`
- `context.source` - which function threw the error, for example `"FileService.writeFile"`
- `context.layer` - `presentation | feature | domain | infrastructure | transport`
- `toLogEntry()` - plain object for server-side logging
- `toUserMessage()` - message safe to show to the user (raw `.message` must never be shown)

- Depends on no other package (leaf node)

---

### Current Ownership

Several formerly shared workspace, workflow-domain, and editor-language modules are now owned directly by app-local code:

- `apps/server/src/slices/workspace/*` owns workspace contracts, path resolution, config handling, file tree analysis, and workspace inspection endpoints.
- `apps/server/src/slices/template/*` owns the template catalog and template list endpoints.
- `apps/server/src/slices/validate/*` is the server-side validation integration boundary.
- `apps/web/src/modules/project-management/*` owns project list, create, import, delete, and project-facing API/state flows.
- `apps/web/src/modules/project-workspace/*` owns active workspace, file tree, workspace orchestration, and sidebar-facing state.
- `apps/web/src/modules/code-editor/*` owns Monaco setup, editor-side context handling, and editor-facing workflow bridges.
- `apps/web/src/modules/workflow-validation/*` owns client-side validation UX and editor feedback.
- `apps/web/src/modules/canvas-interaction/*`, `apps/web/src/modules/workflow-execution/*`, `apps/web/src/modules/save-workflow/*`, and `apps/web/src/modules/save-component/*` own the remaining workflow editing and execution flows.

Only `packages/vnext-types` and `packages/app-contracts` remain as shared packages in this repo.

---

### apps/web

React 19 + Vite 6. The web app uses a simple module-based vertical slice structure, not FSD. Keep the structure shallow and owner-based.

The active structure is `app / pages / modules / shared`. `entities / features / widgets / routes / stores / components / hooks` are no longer target top-level owners for web code.

The main architecture rules live in `apps/web/.agents/skills/architectural-pattern/SKILL.md`. Keep this top-level guide shorter than that skill.

- Start with the narrowest owner and the shallowest folder that keeps the code understandable.
- Default structure: `app -> pages -> modules -> shared`.
- `pages` owns route entry and route composition.
- `modules` owns business UI, module state, and module-local services.
- `shared` stays narrow and generic.
- If unsure, choose `modules`.
- Do not create `model`, `ui`, `hooks`, or `types` subfolders by reflex. Colocate files in the owning folder until extra structure is justified.
- `packages/*` may be imported from any layer.
- Use path aliases/path mappings instead of deep relative imports.
- Utility/helper-style infrastructure files under areas such as `api`, `config`, or `lib` should start with a lowercase letter, for example `client.ts`, `env.ts`, `logger.ts`, or `vNextErrorHelpers.ts`.
- When a file name starts with the product prefix, write it as `vNext`, not `Vnext` or `vnext`. If `vnext` appears later in the name, keep normal word casing for that position, for example `ErrorVnextHelper.ts`.

```text
app/
  providers/          -> ReactFlowProvider, QueryClientProvider
  routes/             -> Route definitions

pages/                -> route entry and page composition only

modules/              -> user-facing business modules with local UI/state/services
  project-management/ -> project list, create/import/delete, project-facing services
  project-workspace/  -> workspace shell data, file tree, active file coordination
  canvas-interaction/ -> custom nodes/edges, edge actions, auto-layout, canvas persistence
  workflow-validation/-> validation flows, badges, realtime validation, validation adapters
  workflow-execution/ -> execution controls, timelines, simulator/executor flows
  code-editor/        -> editor-facing flows and workflow context bridges
  save-workflow/      -> save workflow behavior
  save-component/     -> save component behavior
  task-editor/        -> task editor behavior and UI ownership
  function-editor/    -> function editor behavior and UI ownership
  extension-editor/   -> extension editor behavior and UI ownership
  schema-editor/      -> schema editor behavior and UI ownership
  view-editor/        -> view editor behavior and UI ownership

shared/
  ui/                 -> generic primitives
  api/                -> Hono RPC client helpers
  config/             -> env.ts, constants.ts
  lib/                -> logger, error helpers, utility modules
```

Pages should stay thin. Business logic should usually live in the owning module. Route files may compose module views, but they should not become a second business owner.

Current migration guidance:

- keep new business code in `src/modules/*` and route entry in `src/pages/*`
- keep `shared` narrow; do not move project/workspace/editor business logic into `shared`
- do not reintroduce FSD aliases such as `@entities`, `@features`, or `@widgets`
- do not add new top-level `src/stores/*`, `src/hooks/*`, or `src/components/*` owners
- treat any remaining `legacy-*` module area as temporary migration quarantine, not as a destination pattern

---

### apps/server

Hono BFF (Node.js). All file system and external service access lives here.

The server is organized by slices. Each slice owns its router, controller, schema, and service-level collaborators.

```text
src/
  index.ts                       -> Hono app + AppType export (for Hono RPC)

  slices/
    project/                     -> Project routes, controller, schema, service, types
    runtime-proxy/               -> Engine API proxy routes
    template/
      catalog.ts                 -> Template catalog now owned by server
      controller.ts              -> Template list endpoint orchestration
    validate/
      controller.ts              -> Validation endpoint orchestration
      service.ts                 -> Server-side validation integration boundary
    workspace/
      workspace-contracts.ts     -> Workspace contracts and structure types
      constants.ts               -> Standard workspace file and directory names
      resolver.ts                -> Workspace path resolution helpers
      workspace-analyzer.ts      -> Workspace analysis and config reading
      service.ts                 -> File and workspace operations
      controller.ts              -> Workspace endpoint orchestration

  shared/
    middleware/
      error-handler.ts           -> `VnextForgeError` -> `ApiResponse<never>` mapping
      logger.ts                  -> Central logger middleware
      trace-id.ts                -> Request trace identifier middleware
    lib/
      request.ts                 -> Request parsing helpers
      response-helpers.ts        -> `ApiResponse` success helpers
```

**Error flow:** service throws `new VnextForgeError(...)` -> `error-handler.ts` catches it -> logs with `toLogEntry()` -> returns `toUserMessage()` + `traceId` to the client.

---

### Web <-> Server Communication (Hono RPC)

The server exports `AppType`. The web layer creates a fully typed client with `hc<AppType>('/')` (`shared/api/client.ts`). The response envelope is always `ApiResponse<T>`.

New endpoint access should be colocated with the owning module unless there is a clear, stable shared abstraction that justifies lifting it elsewhere.

---

### Web Logging

- In `apps/web`, do not add raw `console.log`, `console.info`, `console.warn`, or `console.error` calls in application code.
- Route logs through the shared logger in `@shared/lib/logger`.
- Create scoped loggers with `createLogger('ModuleName')` so log output stays attributable.
- The shared logger is the only place allowed to talk directly to `console.*`.
