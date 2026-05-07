# Server Standardization — Design Spec

**Date:** 2026-04-03
**Branch:** migrate-to-fsd
**Scope:** `packages/workspace-service`, `apps/server`

---

## Goal

Transform `apps/server` from a bare-bones Hono skeleton into a properly layered BFF:

- All responses use `ApiResponse<T>` from `@vnext-forge-studio/app-contracts`
- All errors are `VnextForgeError` — no raw `Error` throws or `{ error: String(e) }` responses
- A single `error-handler` middleware owns the translation boundary
- `workspace-service` package is implemented and consumed by the server
- `AppType` is exported for Hono RPC

---

## 1. workspace-service Package

### Responsibility

Knows what a workspace directory *is* — reads and describes it. Does **not** manage the project registry (link files, PROJECTS_DIR). That stays in `apps/server`.

### Structure

```
packages/workspace-service/src/
  interfaces/
    workspace.ts          → IWorkspace, WorkspaceConfig, WorkspaceMetadata
    workspace-tree.ts     → FileTreeNode, WorkspaceStructure
  paths/
    constants.ts          → CONFIG_FILE, COMPONENT_DIRS
    resolver.ts           → resolves standard paths from a workspace root
  analyzer/
    types.ts              → WorkspaceAnalysisResult
    workspace-analyzer.ts → reads a directory, parses WorkspaceConfig, builds file tree
  index.ts                → public exports
```

> `rules/` (structure-rules, naming-rules, config-rules) is out of scope for this spec — deferred to the project health check feature (Phase 3).

### Interfaces

**`interfaces/workspace.ts`**

```ts
export interface WorkspacePaths {
  componentsRoot: string;
  tasks: string;
  views: string;
  functions: string;
  extensions: string;
  workflows: string;
  schemas: string;
  mappings: string;
}

export interface WorkspaceExports {
  functions: string[];
  workflows: string[];
  tasks: string[];
  views: string[];
  schemas: string[];
  extensions: string[];
  visibility: 'private' | 'public';
  metadata: Record<string, unknown>;
}

export interface WorkspaceDependencies {
  domains: string[];
  npm: string[];
}

export interface ReferenceResolutionConfig {
  enabled: boolean;
  validateOnBuild: boolean;
  strictMode: boolean;
}

export interface WorkspaceConfig {
  version: string;
  domain: string;
  description?: string;
  runtimeVersion: string;
  schemaVersion: string;
  paths: WorkspacePaths;
  exports: WorkspaceExports;
  dependencies: WorkspaceDependencies;
  referenceResolution: ReferenceResolutionConfig;
}

export interface IWorkspace {
  domain: string;
  description?: string;
  rootPath: string;
  version?: string;
  config?: WorkspaceConfig;
}

export interface WorkspaceMetadata {
  domain: string;
  description?: string;
  version?: string;
}
```

**`interfaces/workspace-tree.ts`**

```ts
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface WorkspaceStructure {
  root: FileTreeNode;
}
```

### Paths

**`paths/constants.ts`**

```ts
export const CONFIG_FILE = 'vnext.config.json'
export const COMPONENT_DIRS = ['Workflows', 'Mappings', 'Schemas', 'Tasks', 'Views', 'Functions', 'Extensions']
```

**`paths/resolver.ts`**

```ts
export function resolveConfigPath(workspaceRoot: string): string
export function resolveComponentPath(workspaceRoot: string, domain: string, component: string): string
```

### Analyzer

**`analyzer/types.ts`**

```ts
export interface WorkspaceAnalysisResult {
  rootPath: string;
  config: WorkspaceConfig | null;
  configValid: boolean;
  tree: FileTreeNode;
}
```

**`analyzer/workspace-analyzer.ts`**

```ts
export class WorkspaceAnalyzer {
  async analyze(rootPath: string): Promise<WorkspaceAnalysisResult>
  async readConfig(rootPath: string): Promise<WorkspaceConfig>
  async buildTree(rootPath: string): Promise<FileTreeNode>
}
```

- Uses Node.js `fs` — server-only
- Translates `fs` errors into `VnextForgeError` with `layer: 'infrastructure'`
- `ENOENT` → `FILE_NOT_FOUND`, `EACCES` → `FILE_PERMISSION_DENIED`, parse failure → `PROJECT_INVALID_CONFIG`

### Responsibility split (migrating from ProjectService)

| Currently in | Moves to |
|---|---|
| `ProjectInfo` interface | `interfaces/workspace.ts → IWorkspace` |
| `FileTreeNode` interface | `interfaces/workspace-tree.ts` |
| `vnext.config.json` read/parse logic | `analyzer/workspace-analyzer.ts` |
| `buildTree()` private method | `analyzer/workspace-analyzer.ts` |
| Link file logic, PROJECTS_DIR | Stays in `project.service.ts` |
| Create/import/remove project | Stays in `project.service.ts` |

### Dependencies

```json
{
  "dependencies": {
    "@vnext-forge-studio/app-contracts": "workspace:*"
  }
}
```

---

## 2. Server Folder Structure

```
apps/server/src/
  index.ts                  → Hono app, middleware order, AppType export
  routes/
    files.ts
    projects.ts
    validate.ts
    runtime-proxy.ts
    templates.ts
  services/
    file.service.ts         → updated: VnextForgeError
    project.service.ts      → updated: uses workspace.service, VnextForgeError
    workspace.service.ts    → NEW: thin wrapper over WorkspaceAnalyzer
    export.service.ts       → updated: VnextForgeError
  middleware/
    error-handler.ts        → NEW: VnextForgeError → ApiFailure
    trace-id.ts             → NEW: generates traceId per request
  lib/
    response.ts             → NEW: ok() helper
```

### Dependencies to add

```json
{
  "dependencies": {
    "@vnext-forge-studio/app-contracts": "workspace:*",
    "@vnext-forge-studio/workspace-service": "workspace:*"
  }
}
```

---

## 3. Middleware

### middleware/trace-id.ts

- Generates `crypto.randomUUID()` on each request
- Stores in Hono context: `c.set('traceId', id)`
- Sets `X-Trace-Id` response header

### middleware/error-handler.ts

Registered as `app.onError()`. Single translation boundary.

```
VnextForgeError:
  → error.toLogEntry()    → structured server log (never sent to client)
  → error.toUserMessage() → ApiFailure body
  → ErrorCode → HTTP status (see table below)

Unknown error:
  → raw log
  → INTERNAL_UNEXPECTED → ApiFailure, status 500
```

**ErrorCode → HTTP Status:**

| Error codes | HTTP Status |
|---|---|
| `FILE_NOT_FOUND`, `PROJECT_NOT_FOUND`, `API_NOT_FOUND` | 404 |
| `FILE_INVALID_PATH`, `API_BAD_REQUEST` | 400 |
| `FILE_PERMISSION_DENIED`, `API_FORBIDDEN` | 403 |
| `API_UNAUTHORIZED` | 401 |
| `API_CONFLICT`, `PROJECT_ALREADY_EXISTS` | 409 |
| `API_UNPROCESSABLE` | 422 |
| `RUNTIME_*` | 502 |
| Everything else | 500 |

### lib/response.ts

```ts
export function ok<T>(data: T, meta?: ResponseMeta): ApiSuccess<T>
```

Route handlers use `ok()` for success responses. Failure is always via `throw VnextForgeError`.

---

## 4. Request-to-Response Flow

```
1. traceId middleware  → generates traceId, sets context + header
2. logger middleware   → logs incoming request
3. cors middleware     → sets CORS headers
4. route handler       → validates input, calls service, returns c.json(ok(data))
5. error-handler       → catches VnextForgeError → ApiFailure
6. notFound handler    → API_NOT_FOUND → ApiFailure, 404
```

### Route handler pattern (after)

```ts
// No try/catch in route handlers
routeGroup.get('/:id', async (c) => {
  const id = c.req.param('id')
  const traceId = c.get('traceId')

  if (!id) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'id param required',
      { source: 'projectRoutes.getById', layer: 'transport' },
      traceId,
    )
  }

  const project = await projectService.getProject(id, traceId)
  return c.json(ok(project))
})
```

### Error propagation by layer

| Layer | ErrorLayer | Example |
|---|---|---|
| Route handler input validation | `transport` | missing required param |
| ProjectService business rule | `application` | project not found in registry |
| WorkspaceService fs operation | `infrastructure` | ENOENT on config read |
| WorkspaceAnalyzer parse failure | `infrastructure` | invalid JSON in vnext.config.json |

---

## 5. index.ts

```ts
const app = new Hono()

app.use('*', traceIdMiddleware)
app.use('*', logger())
app.use('*', cors())

app.route('/api/projects', projectRoutes)
app.route('/api/files', fileRoutes)
app.route('/api/runtime', runtimeProxyRoutes)
app.route('/api/validate', validateRoutes)
app.route('/api/templates', templateRoutes)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.onError(errorHandler)
// notFound does NOT go through onError in Hono — construct ApiFailure directly
app.notFound((c) => {
  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: ERROR_CODES.API_NOT_FOUND,
        message: 'The requested route does not exist.',
        traceId: c.get('traceId'),
      },
    } satisfies ApiFailure,
    404,
  )
})

export type AppType = typeof app
export default app
```

---

## 6. What Is NOT in Scope

- Hono RPC typed input/output (zod validators on routes) — separate task
- `workspace-service` rules/ and analyzer health checks — Phase 3
- `validate.ts` route full implementation (workflow-system) — separate task
- `validation.service.ts` — separate task
- `workspace.ts` route (workspace analysis endpoint) — separate task
