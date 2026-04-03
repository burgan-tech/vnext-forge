# vnext-forge - Project Context

Visual workflow designer: React Flow canvas + Monaco code editor. Monorepo with pnpm workspaces + Turborepo.

## Project Goal

The main purpose of this project is to provide the **standalone UI** for a workflow engine runtime application. It acts as the frontend surface for another application domain, but it is intentionally built and delivered as an independent product.

The UI is not limited to workflow visualization. It is responsible for the end-to-end management of workflow definitions described in JSON, including creating workflows through the interface, editing them, validating workflow definitions, validating workflow data, running tests and simulations, and supporting other runtime-related workflow operations from the UI.

In short, the product is meant to be a standalone design and management interface for the workflow engine ecosystem, focused on authoring, verification, and operational workflow tooling.

---

### Packages

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

**2. VnextError** (`error/vnext-error.ts`):
The shared error type used across all application layers. Every `throw` should be a `VnextError`.

- `code: ErrorCode` - `FILE_*`, `PROJECT_*`, `WORKFLOW_*`, `RUNTIME_*`, `SIMULATION_*`, `GIT_*`, `API_*`, `INTERNAL_*`
- `context.source` - which function threw the error, for example `"FileService.writeFile"`
- `context.layer` - `presentation | feature | domain | infrastructure | transport`
- `toLogEntry()` - plain object for server-side logging
- `toUserMessage()` - message safe to show to the user (raw `.message` must never be shown)

- Depends on no other package (leaf node)

---

#### `packages/workflow-system` -> `@vnext-forge/workflow-system`

Workflow domain logic. No UI, isomorphic (browser + Node.js).

```text
schema/
  workflow-schema.ts      -> Full workflow JSON schema with Zod
  component-schema.ts     -> Zod schemas for Task, Schema, View, Function, Extension
  version-compat.ts       -> Runtime version compatibility matrix + checks

validation/
  rules/
    structural-rules.ts   -> Content moved from ValidationEngine.ts (15+ rules)
    semantic-rules.ts     -> Cross-reference, reachability, cycle detection
    schema-rules.ts       -> Zod schema conformity checks
  validate.ts             -> Engine that runs all validation rules
  types.ts                -> ValidationResult, Severity

connection/
  connection-rules.ts     -> Which stateType can connect to which stateType
  connection-validator.ts -> Connection validity checks

health/
  project-health.ts       -> Project file structure analysis
  health-rules.ts         -> Checks for missing files, wrong types, broken references
  types.ts                -> HealthCheckResult, HealthIssue

simulation/
  simulator.ts            -> Step-by-step state machine execution
  step-evaluator.ts       -> Single step: transition selection + next state
  execution-context.ts    -> SimulationState, test data
  types.ts                -> SimulationResult, StepResult

utils/
  graph.ts                -> Reachability, cycle detection
```

- Dependencies: `@vnext-forge/types`, `@vnext-forge/app-contracts`, `zod`
- Used by `apps/server` for save-time validation and by `apps/web` for realtime validation

---

#### `packages/workspace-service` -> `@vnext-forge/workspace-service`

Defines workspace (project directory) rules and interfaces.

```text
interfaces/
  workspace.ts            -> IWorkspace, WorkspaceConfig, WorkspaceMetadata
  workspace-tree.ts       -> FileTreeNode, WorkspaceStructure
  workspace-paths.ts      -> Standard file paths

rules/
  structure-rules.ts      -> Required file/directory structure rules
  naming-rules.ts         -> File naming standards
  config-rules.ts         -> `vnext.config.json` format rules

analyzer/
  workspace-analyzer.ts   -> Analyzes the directory and returns WorkspaceAnalysisResult
  types.ts                -> WorkspaceAnalysisResult, WorkspaceIssue

paths/
  resolver.ts             -> Resolves standard paths inside a workspace
  constants.ts            -> `WORKFLOW_FILE`, `DIAGRAM_FILE`, `CONFIG_FILE` constants
```

- `rules/` and `analyzer/` run only on `apps/server` (they use Node.js `fs` APIs)
- `interfaces/` and `paths/` are imported by both web and server; no Node.js APIs are used on the web
- Dependencies: `@vnext-forge/types`, `@vnext-forge/app-contracts`

---

#### `packages/editor-kit` -> `@vnext-forge/editor-kit`

Monaco Editor language support. Completions, diagnostics, snippets, and hover support for CSX (C# Script) and Workflow JSON.

```text
csx/
  completions/
    csx-completions.ts      -> CSX completions (handler scope, interface types)
    csx-api-reference.ts    -> API reference database
    context-detector.ts     -> Detects the active handler scope
  diagnostics/
    csx-diagnostics.ts      -> CSX linter markers
    rules/
      condition-rules.ts    -> Rules such as enforcing `return true/false`
      mapping-rules.ts      -> Rules such as InputHandler cast requirements
  snippets/
    csx-snippets.ts
    csx-templates.ts
  hover/
    csx-hover.ts            -> Hover doc provider

workflow/
  completions/
    workflow-completions.ts -> Context-aware workflow intellisense
  diagnostics/
    workflow-diagnostics.ts -> Workflow JSON linter markers

setup/
  monaco-setup.ts           -> Monaco setup (to be moved into MonacoSetup.ts)
  language-registry.ts      -> Facade that registers all languages to Monaco
```

Main API: `setupEditorLanguages(monaco, context)` + `updateLanguageContext(context)`.
`EditorLanguageContext` - active workflow, active state key, accessible components.

- Dependencies: `@vnext-forge/types`, `monaco-editor` (peer dependency)
- Currently only used by `apps/web`; a desktop app may consume it later

---

### apps/web

React 19 + Vite 6. Organized with FSD (Feature-Sliced Design).

**Layer import rule:** `app -> pages -> widgets -> features -> entities -> shared`

- Upper layers may import lower layers; the reverse is forbidden
- `entities` cannot import each other, and `features` cannot import each other
- `packages/*` may be imported from any layer
- Enforced by ESLint: `@feature-sliced/eslint-config`

```text
app/
  providers/          -> ReactFlowProvider, QueryClientProvider
  routes/             -> Route definitions

pages/               -> project-list, project-workspace, flow-editor, task-editor,
                        schema-editor, view-editor, function-editor, extension-editor, code-editor
                        (each page is thin composition; business logic lives in features/entities)

widgets/             -> Large, independent UI blocks
  flow-canvas/        -> FlowCanvas, CanvasToolbar, CanvasContextMenu
  property-panel/     -> StatePropertyPanel, TransitionPropertyPanel, WorkflowMetadataPanel
  script-editor-panel/-> ScriptEditorPanel, CodeEditorPanel
  sidebar/            -> Sidebar, FileTree
  validation-panel/   -> Validation results
  execution-overlay/  -> (Phase 4) Highlight active nodes on the canvas
  health-check-panel/ -> (Phase 3) Workspace issues

features/            -> User scenarios
  canvas-interaction/ -> Custom nodes/edges, EdgeHoverToolbar, NodeHoverActions,
                         connection-rules-adapter, auto-layout, canvas-persistence
  workflow-validation/-> ValidationStore, ValidationBadge, realtime-validator (debounced)
  project-health/     -> HealthStore, health-check-runner (calls workspace-service)
  workflow-execution/ -> ExecutionStore, ExecutionControlBar, ExecutionDataInput,
                         ExecutionTimeline, local-simulator, remote-executor
  engine-integration/ -> (Phase 5) engine-client, polling-manager
  code-editor/        -> EditorStore, ResizableLayout, editor-setup (boots editor-kit),
                         workflow-context-bridge
  save-workflow/      -> useSaveWorkflow hook
  save-component/     -> useSaveComponent hook
  ai-assistant/       -> SLOT ONLY - interface definitions, no implementation

entities/            -> Domain stores
  workflow/           -> workflow-store, conversion utilities
  project/            -> project-store, file-router
  component/          -> component-store
  runtime/            -> runtime-store

shared/
  ui/                 -> Field, KVEditor, LabelEditor, TagEditor, JsonCodeField and other primitives
  api/
    client.ts         -> Hono RPC typed client: `hc<AppType>('/')`
  config/             -> env.ts, constants.ts
  lib/
    error-handler.ts  -> `VnextError` -> user-friendly message mapping
    logger.ts         -> Logger that uses `VnextError.toLogEntry()`
```

---

### apps/server

Hono BFF (Node.js). All file system and external service access lives here.

```text
index.ts                -> Hono app + AppType export (for Hono RPC)

routes/
  files.ts              -> File CRUD
  projects.ts           -> Project management
  validate.ts           -> Workflow validation (`workflow-system` integration)
  runtime-proxy.ts      -> Engine API proxy
  workspace.ts          -> (NEW) Workspace analysis endpoints
  templates.ts          -> Template list

services/
  file.service.ts       -> `fs` operations
  project.service.ts    -> Project read/write
  export.service.ts     -> Export operations
  workspace.service.ts  -> (NEW) Service using the `workspace-service` package
  validation.service.ts -> (NEW) Service using the `workflow-system` package

middleware/
  error-handler.ts      -> `VnextError` -> `ApiResponse<never>` mapping (including HTTP status mapping)
  logger.ts             -> Central logger

lib/
  response.ts           -> `ApiResponse` helpers
```

**Error flow:** service throws `new VnextError(...)` -> `error-handler.ts` catches it -> logs with `toLogEntry()` -> returns `toUserMessage()` + `traceId` to the client.

---

### Web <-> Server Communication (Hono RPC)

The server exports `AppType`. The web layer creates a fully typed client with `hc<AppType>('/')` (`shared/api/client.ts`). The response envelope is always `ApiResponse<T>`.

Existing flat `fetch('/api/...')` calls will be migrated to this client (Phase 1.6).

---
