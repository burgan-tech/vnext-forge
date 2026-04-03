# Server Vertical Slice Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/server/src` from horizontal-layer structure (controllers/ + routes/ + services/) to vertical slice structure (one folder per domain, shared infrastructure under shared/).

**Architecture:** Each domain slice (project, workspace, validate, runtime-proxy, template) owns its router, controller, service, and schema in a flat folder. Shared infrastructure (middleware, lib, types) lives under `src/shared/`. The `baseController` object pattern is replaced with plain helper functions in `shared/lib/response.ts`. URL paths are unchanged — the web layer is unaffected.

**Tech Stack:** Hono, Zod, TypeScript, Node.js fs/promises, `@vnext-studio/app-contracts`, `@vnext-studio/workspace-service`, `@vnext-studio/workflow-system`

---

## File Map

### Created
| File | Responsibility |
|---|---|
| `src/shared/middleware/error-handler.ts` | Moved from `src/middleware/error-handler.ts` |
| `src/shared/middleware/trace-id.ts` | Moved from `src/middleware/trace-id.ts` |
| `src/shared/lib/request.ts` | Moved from `src/lib/request.ts` |
| `src/shared/lib/response.ts` | New — `ok/created/empty` helper functions |
| `src/shared/types/hono.ts` | Moved from `src/types/hono.ts` |
| `src/template/router.ts` | Hono router for /api/templates |
| `src/template/controller.ts` | Template HTTP handlers |
| `src/template/schema.ts` | Template request schemas |
| `src/validate/router.ts` | Hono router for /api/validate |
| `src/validate/controller.ts` | Validate HTTP handlers |
| `src/validate/service.ts` | Validation logic stub (workflow-system integration point) |
| `src/validate/schema.ts` | Validate request schemas |
| `src/runtime-proxy/router.ts` | Hono router for /api/runtime |
| `src/runtime-proxy/controller.ts` | Proxy HTTP handler |
| `src/runtime-proxy/schema.ts` | Runtime proxy request schemas |
| `src/workspace/router.ts` | Hono router for /api/files |
| `src/workspace/controller.ts` | Merged file + workspace HTTP handlers |
| `src/workspace/service.ts` | Merged FileService + WorkspaceService |
| `src/workspace/schema.ts` | Merged file request schemas |
| `src/workspace/types.ts` | SearchResult, DirectoryEntry |
| `src/project/router.ts` | Hono router for /api/projects |
| `src/project/controller.ts` | Project HTTP handlers |
| `src/project/service.ts` | ProjectService (absorbs ExportService) |
| `src/project/schema.ts` | Project request schemas |
| `src/project/types.ts` | ProjectEntry, LinkFile |

### Modified
| File | Change |
|---|---|
| `src/index.ts` | Mount slice routers; remove old imports |
| `tsconfig.json` | Replace old aliases with new slice aliases |

### Deleted
| Path | Reason |
|---|---|
| `src/controllers/` | Replaced by slice controller.ts files |
| `src/routes/` | Replaced by slice router.ts files |
| `src/services/` | Replaced by slice service.ts files |
| `src/middleware/` | Moved to src/shared/middleware/ |
| `src/lib/` | Moved to src/shared/lib/ |
| `src/types/` | Moved to src/shared/types/ |

---

## Task 1: Create `shared/` and update `tsconfig.json`

**Files:**
- Create: `src/shared/middleware/error-handler.ts`
- Create: `src/shared/middleware/trace-id.ts`
- Create: `src/shared/lib/request.ts`
- Create: `src/shared/lib/response.ts`
- Create: `src/shared/types/hono.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create `src/shared/middleware/error-handler.ts`** (exact copy of current file)

```ts
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import {
  ERROR_CODES,
  VnextForgeError,
  internalFailure,
} from '@vnext-studio/app-contracts'
import type { ErrorCode } from '@vnext-studio/app-contracts'

function statusFromErrorCode(code: ErrorCode): ContentfulStatusCode {
  switch (code) {
    case ERROR_CODES.FILE_NOT_FOUND:
    case ERROR_CODES.PROJECT_NOT_FOUND:
    case ERROR_CODES.API_NOT_FOUND:
      return 404
    case ERROR_CODES.FILE_INVALID_PATH:
    case ERROR_CODES.API_BAD_REQUEST:
      return 400
    case ERROR_CODES.FILE_PERMISSION_DENIED:
    case ERROR_CODES.API_FORBIDDEN:
      return 403
    case ERROR_CODES.API_UNAUTHORIZED:
      return 401
    case ERROR_CODES.API_CONFLICT:
    case ERROR_CODES.PROJECT_ALREADY_EXISTS:
      return 409
    case ERROR_CODES.API_UNPROCESSABLE:
      return 422
    case ERROR_CODES.RUNTIME_CONNECTION_FAILED:
    case ERROR_CODES.RUNTIME_TIMEOUT:
    case ERROR_CODES.RUNTIME_INVALID_RESPONSE:
      return 502
    default:
      return 500
  }
}

export function jsonErrorResponse(c: Context, error: VnextForgeError): Response {
  return c.json(error.toFailure(), statusFromErrorCode(error.code))
}

export const errorHandler = (error: Error, c: Context) => {
  if (error instanceof ZodError) {
    return jsonErrorResponse(
      c,
      new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'Request validation failed.',
        {
          source: 'errorHandler.zod',
          layer: 'transport',
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          },
        },
        c.get('traceId'),
      ),
    )
  }

  if (error instanceof VnextForgeError) {
    console.error(error.toLogEntry())
    return jsonErrorResponse(c, error)
  }

  const traceId = c.get('traceId')
  console.error({
    code: ERROR_CODES.INTERNAL_UNEXPECTED,
    message: error instanceof Error ? error.message : 'Unknown error',
    traceId,
  })

  return c.json(internalFailure(traceId), 500)
}
```

- [ ] **Step 2: Create `src/shared/middleware/trace-id.ts`**

```ts
import { randomUUID } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

export const traceIdMiddleware: MiddlewareHandler = async (c, next) => {
  const traceId = randomUUID()
  c.set('traceId', traceId)
  c.header('X-Trace-Id', traceId)
  await next()
}
```

- [ ] **Step 3: Create `src/shared/lib/request.ts`** (exact copy of current `src/lib/request.ts`)

```ts
import type { Context } from 'hono'
import {
  ERROR_CODES,
  VnextForgeError,
  type VnextForgeErrorContext,
} from '@vnext-studio/app-contracts'
import type { ZodTypeAny } from 'zod'

export interface RequestSchemas {
  params?: ZodTypeAny
  query?: ZodTypeAny
  json?: ZodTypeAny
  headers?: ZodTypeAny
}

type InferSchema<TSchema> = TSchema extends ZodTypeAny ? TSchema['_output'] : undefined

export interface ParsedRequest<TSchemas extends RequestSchemas> {
  params: InferSchema<TSchemas['params']>
  query: InferSchema<TSchemas['query']>
  json: InferSchema<TSchemas['json']>
  headers: InferSchema<TSchemas['headers']>
}

function invalidJsonError(
  traceId: string | undefined,
  context: VnextForgeErrorContext,
  cause: unknown,
): VnextForgeError {
  return new VnextForgeError(
    ERROR_CODES.API_BAD_REQUEST,
    'Request body must be valid JSON.',
    {
      ...context,
      details: {
        ...context.details,
        cause: cause instanceof Error ? cause.message : cause,
      },
    },
    traceId,
  )
}

export async function parseRequest<TSchemas extends RequestSchemas>(
  c: Context,
  schemas: TSchemas,
  source: string,
): Promise<ParsedRequest<TSchemas>> {
  const context: VnextForgeErrorContext = {
    source,
    layer: 'transport',
  }

  const parsed: Partial<ParsedRequest<TSchemas>> = {}

  if (schemas.params) {
    parsed.params = schemas.params.parse(c.req.param()) as ParsedRequest<TSchemas>['params']
  }

  if (schemas.query) {
    parsed.query = schemas.query.parse(c.req.query()) as ParsedRequest<TSchemas>['query']
  }

  if (schemas.headers) {
    const headers = Object.fromEntries(c.req.raw.headers.entries())
    parsed.headers = schemas.headers.parse(headers) as ParsedRequest<TSchemas>['headers']
  }

  if (schemas.json) {
    let body: unknown
    try {
      body = await c.req.json()
    } catch (error) {
      throw invalidJsonError(c.get('traceId'), context, error)
    }
    parsed.json = schemas.json.parse(body) as ParsedRequest<TSchemas>['json']
  }

  return parsed as ParsedRequest<TSchemas>
}
```

- [ ] **Step 4: Create `src/shared/lib/response.ts`** (new file replacing baseController)

```ts
import type { Context } from 'hono'
import { success } from '@vnext-studio/app-contracts'
import type { ResponseMeta } from '@vnext-studio/app-contracts'

export const ok = <T>(c: Context, data: T, meta?: ResponseMeta): Response =>
  c.json(success(data, meta))

export const created = <T>(c: Context, data: T, meta?: ResponseMeta): Response =>
  c.json(success(data, meta), 201)

export const empty = (c: Context): Response => c.json(success(null))
```

- [ ] **Step 5: Create `src/shared/types/hono.ts`**

```ts
declare module 'hono' {
  interface ContextVariableMap {
    traceId: string
  }
}

export {}
```

- [ ] **Step 6: Update `tsconfig.json` — replace old aliases with new slice aliases**

Replace the `"paths"` block in `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "types": ["node"],
    "paths": {
      "@project/*": ["./src/project/*"],
      "@workspace/*": ["./src/workspace/*"],
      "@validate/*": ["./src/validate/*"],
      "@runtime-proxy/*": ["./src/runtime-proxy/*"],
      "@template/*": ["./src/template/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"],
  "references": [
    { "path": "../../packages/vnext-types" },
    { "path": "../../packages/app-contracts" },
    { "path": "../../packages/workflow-system" },
    { "path": "../../packages/workspace-service" }
  ]
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/shared apps/server/tsconfig.json
git commit -m "refactor(server): add shared/ infrastructure layer"
```

---

## Task 2: Migrate `template/` slice

**Files:**
- Create: `src/template/schema.ts`
- Create: `src/template/controller.ts`
- Create: `src/template/router.ts`

- [ ] **Step 1: Create `src/template/schema.ts`**

```ts
import type { RequestSchemas } from '@shared/lib/request.js'

export const templateListRequestSchema = {} satisfies RequestSchemas
```

- [ ] **Step 2: Create `src/template/controller.ts`**

```ts
import type { Context } from 'hono'
import { workflowTemplateCatalog } from '@vnext-studio/workflow-system'
import { parseRequest } from '@shared/lib/request.js'
import { ok } from '@shared/lib/response.js'
import { templateListRequestSchema } from './schema.js'

export const templateController = {
  async list(c: Context): Promise<Response> {
    await parseRequest(c, templateListRequestSchema, 'templateController.list')
    return ok(c, workflowTemplateCatalog)
  },
}
```

- [ ] **Step 3: Create `src/template/router.ts`**

```ts
import { Hono } from 'hono'
import { templateController } from './controller.js'

export const templateRouter = new Hono()

templateRouter.get('/', (c) => templateController.list(c))
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/template
git commit -m "refactor(server): migrate template slice"
```

---

## Task 3: Migrate `validate/` slice

**Files:**
- Create: `src/validate/schema.ts`
- Create: `src/validate/service.ts`
- Create: `src/validate/controller.ts`
- Create: `src/validate/router.ts`

- [ ] **Step 1: Create `src/validate/schema.ts`**

```ts
import { z } from 'zod'

export const validateRequestSchema = {
  json: z.unknown(),
}
```

- [ ] **Step 2: Create `src/validate/service.ts`**

```ts
// Integration point for @vnext-studio/workflow-system validation.
// Currently returns a stub; full implementation wires in workflow-system validate().
export const validateService = {
  validate(_workflow: unknown): { valid: boolean; errors: unknown[]; warnings: unknown[] } {
    return { valid: true, errors: [], warnings: [] }
  },
}
```

- [ ] **Step 3: Create `src/validate/controller.ts`**

```ts
import type { Context } from 'hono'
import { parseRequest } from '@shared/lib/request.js'
import { ok } from '@shared/lib/response.js'
import { validateService } from './service.js'
import { validateRequestSchema } from './schema.js'

export const validateController = {
  async validate(c: Context): Promise<Response> {
    const { json } = await parseRequest(c, validateRequestSchema, 'validateController.validate')
    const result = validateService.validate(json)
    return ok(c, result)
  },
}
```

- [ ] **Step 4: Create `src/validate/router.ts`**

```ts
import { Hono } from 'hono'
import { validateController } from './controller.js'

export const validateRouter = new Hono()

validateRouter.post('/', (c) => validateController.validate(c))
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/validate
git commit -m "refactor(server): migrate validate slice"
```

---

## Task 4: Migrate `runtime-proxy/` slice

**Files:**
- Create: `src/runtime-proxy/schema.ts`
- Create: `src/runtime-proxy/controller.ts`
- Create: `src/runtime-proxy/router.ts`

- [ ] **Step 1: Create `src/runtime-proxy/schema.ts`**

```ts
import { z } from 'zod'

export const runtimeProxyRequestSchema = {
  headers: z.object({
    'x-runtime-url': z.string().url().optional(),
  }),
}
```

- [ ] **Step 2: Create `src/runtime-proxy/controller.ts`**

```ts
import type { Context } from 'hono'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import { parseRequest } from '@shared/lib/request.js'
import { runtimeProxyRequestSchema } from './schema.js'

export const runtimeProxyController = {
  async proxy(c: Context): Promise<Response> {
    const { headers } = await parseRequest(
      c,
      runtimeProxyRequestSchema,
      'runtimeProxyController.proxy',
    )
    const runtimeUrl = headers['x-runtime-url'] || 'http://localhost:4201'
    const runtimePath = c.req.path.replace('/api/runtime', '')
    const url = `${runtimeUrl}${runtimePath}`
    const queryString = new URLSearchParams(c.req.query()).toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url

    try {
      const method = c.req.method
      const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      const options: RequestInit = { method, headers: requestHeaders }

      if (method !== 'GET' && method !== 'HEAD') {
        const body = await c.req.text()
        if (body) {
          options.body = body
        }
      }

      const response = await fetch(fullUrl, options)
      const data = await response.text()

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
      })
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_CONNECTION_FAILED,
        error instanceof Error ? error.message : 'Runtime connection failed',
        {
          source: 'runtimeProxyController.proxy',
          layer: 'infrastructure',
          details: { runtimeUrl, fullUrl, method: c.req.method },
        },
        c.get('traceId'),
      )
    }
  },
}
```

- [ ] **Step 3: Create `src/runtime-proxy/router.ts`**

```ts
import { Hono } from 'hono'
import { runtimeProxyController } from './controller.js'

export const runtimeProxyRouter = new Hono()

runtimeProxyRouter.all('/*', (c) => runtimeProxyController.proxy(c))
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/runtime-proxy
git commit -m "refactor(server): migrate runtime-proxy slice"
```

---

## Task 5: Migrate `workspace/` slice

**Files:**
- Create: `src/workspace/types.ts`
- Create: `src/workspace/schema.ts`
- Create: `src/workspace/service.ts`
- Create: `src/workspace/controller.ts`
- Create: `src/workspace/router.ts`

- [ ] **Step 1: Create `src/workspace/types.ts`**

```ts
export interface SearchResult {
  path: string
  line: number
  text: string
}

export interface DirectoryEntry {
  name: string
  path: string
  type: 'file' | 'directory'
}
```

- [ ] **Step 2: Create `src/workspace/schema.ts`**

```ts
import { homedir } from 'node:os'
import { z } from 'zod'

export const fileReadRequestSchema = {
  query: z.object({
    path: z.string().min(1, 'File path is required'),
  }),
}

export const fileWriteRequestSchema = {
  json: z.object({
    path: z.string().min(1, 'File path is required'),
    content: z.string(),
  }),
}

export const fileRemoveRequestSchema = fileReadRequestSchema

export const fileCreateDirectoryRequestSchema = {
  json: z.object({
    path: z.string().min(1, 'Directory path is required'),
  }),
}

export const fileRenameRequestSchema = {
  json: z.object({
    oldPath: z.string().min(1, 'oldPath is required'),
    newPath: z.string().min(1, 'newPath is required'),
  }),
}

export const fileBrowseRequestSchema = {
  query: z.object({
    path: z.string().optional().default(homedir()),
  }),
}

export const fileSearchRequestSchema = {
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
    project: z.string().min(1, 'Project path is required'),
  }),
}
```

- [ ] **Step 3: Create `src/workspace/service.ts`** (merged FileService + WorkspaceService)

```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import {
  CONFIG_FILE,
  WorkspaceAnalyzer,
  resolveComponentPath,
} from '@vnext-studio/workspace-service'
import type {
  WorkspaceAnalysisResult,
  WorkspaceConfig,
  WorkspaceStructure,
} from '@vnext-studio/workspace-service'
import type { SearchResult, DirectoryEntry } from './types.js'

function toDirectoryEntry(dirPath: string, entry: Dirent): DirectoryEntry {
  return {
    name: entry.name,
    path: path.join(dirPath, entry.name),
    type: entry.isDirectory() ? 'directory' : 'file',
  }
}

export class WorkspaceService {
  private readonly analyzer = new WorkspaceAnalyzer()

  // ── File operations ──────────────────────────────────────────────────────────

  async readFile(filePath: string, traceId?: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.readFile', traceId, { filePath })
    }
  }

  async writeFile(filePath: string, content: string, traceId?: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.writeFile', traceId, { filePath })
    }
  }

  async deleteFile(filePath: string, traceId?: string): Promise<void> {
    try {
      await fs.rm(filePath, { recursive: true })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.deleteFile', traceId, { filePath })
    }
  }

  async createDirectory(dirPath: string, traceId?: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.createDirectory', traceId, { dirPath })
    }
  }

  async renameFile(oldPath: string, newPath: string, traceId?: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath)
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.renameFile', traceId, { oldPath, newPath })
    }
  }

  async searchFiles(projectPath: string, query: string, traceId?: string): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    try {
      await this.searchDir(projectPath, query.toLowerCase(), results, traceId)
      return results.slice(0, 100)
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw this.toFileError(error, 'WorkspaceService.searchFiles', traceId, { projectPath, query })
    }
  }

  async browseDirs(dirPath: string, traceId?: string): Promise<DirectoryEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries
        .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => toDirectoryEntry(dirPath, entry))
        .sort((left, right) => {
          if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
          return left.name.localeCompare(right.name)
        })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.browseDirs', traceId, { dirPath })
    }
  }

  // ── Workspace (project directory) operations ─────────────────────────────────

  async analyze(rootPath: string, traceId?: string): Promise<WorkspaceAnalysisResult> {
    return this.analyzer.analyze(rootPath, traceId)
  }

  async getConfig(rootPath: string, traceId?: string): Promise<WorkspaceConfig> {
    return this.analyzer.readConfig(rootPath, traceId)
  }

  async getFileTree(rootPath: string, traceId?: string): Promise<WorkspaceStructure> {
    return { root: await this.analyzer.buildTree(rootPath, traceId) }
  }

  createDefaultConfig(domain: string, description?: string): WorkspaceConfig {
    return {
      domain,
      description,
      version: '1.0.0',
      runtimeVersion: '0.0.33',
      schemaVersion: '0.0.33',
      paths: {
        componentsRoot: domain,
        tasks: 'Tasks',
        views: 'Views',
        functions: 'Functions',
        extensions: 'Extensions',
        workflows: 'Workflows',
        schemas: 'Schemas',
        mappings: 'Mappings',
      },
      exports: {
        functions: [],
        workflows: [],
        tasks: [],
        views: [],
        schemas: [],
        extensions: [],
        visibility: 'private',
        metadata: {},
      },
      dependencies: { domains: [], npm: [] },
      referenceResolution: { enabled: true, validateOnBuild: true, strictMode: false },
    }
  }

  getConfigPath(rootPath: string): string {
    return path.join(rootPath, CONFIG_FILE)
  }

  getComponentPaths(rootPath: string, domain: string): string[] {
    return ['Workflows', 'Mappings', 'Schemas', 'Tasks', 'Views', 'Functions', 'Extensions'].map(
      (component) => resolveComponentPath(rootPath, domain, component),
    )
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async searchDir(
    dirPath: string,
    query: string,
    results: SearchResult[],
    traceId?: string,
  ): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true })
    } catch (error) {
      throw this.toFileError(error, 'WorkspaceService.searchDir', traceId, { dirPath, query })
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        await this.searchDir(fullPath, query, results, traceId)
      } else if (/\.(json|csx|ts|js|md)$/.test(entry.name)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query)) {
              results.push({ path: fullPath, line: i + 1, text: lines[i].trim() })
              if (results.length >= 100) return
            }
          }
        } catch {
          // Skip unreadable or binary files.
        }
      }
      if (results.length >= 100) return
    }
  }

  private toFileError(
    error: unknown,
    source: string,
    traceId?: string,
    details?: Record<string, unknown>,
  ): VnextForgeError {
    if (error instanceof VnextForgeError) return error
    const code = (error as NodeJS.ErrnoException | undefined)?.code

    if (code === 'ENOENT') {
      return new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        'Requested file or directory was not found',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return new VnextForgeError(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        'Insufficient permissions for file system operation',
        { source, layer: 'infrastructure', details },
        traceId,
      )
    }

    const fallbackCode =
      source.includes('delete') || source.includes('Delete')
        ? ERROR_CODES.FILE_DELETE_ERROR
        : source.includes('write') || source.includes('Write') ||
            source.includes('create') || source.includes('Create') ||
            source.includes('rename') || source.includes('Rename')
          ? ERROR_CODES.FILE_WRITE_ERROR
          : ERROR_CODES.FILE_READ_ERROR

    return new VnextForgeError(
      fallbackCode,
      error instanceof Error ? error.message : 'File system operation failed',
      { source, layer: 'infrastructure', details },
      traceId,
    )
  }
}
```

- [ ] **Step 4: Create `src/workspace/controller.ts`**

```ts
import type { Context } from 'hono'
import { parseRequest } from '@shared/lib/request.js'
import { ok, empty } from '@shared/lib/response.js'
import { WorkspaceService } from './service.js'
import {
  fileBrowseRequestSchema,
  fileCreateDirectoryRequestSchema,
  fileReadRequestSchema,
  fileRemoveRequestSchema,
  fileRenameRequestSchema,
  fileSearchRequestSchema,
  fileWriteRequestSchema,
} from './schema.js'

const workspaceService = new WorkspaceService()

export const workspaceController = {
  async read(c: Context): Promise<Response> {
    const { query } = await parseRequest(c, fileReadRequestSchema, 'workspaceController.read')
    const content = await workspaceService.readFile(query.path, c.get('traceId'))
    return ok(c, { path: query.path, content })
  },

  async write(c: Context): Promise<Response> {
    const { json } = await parseRequest(c, fileWriteRequestSchema, 'workspaceController.write')
    await workspaceService.writeFile(json.path, json.content, c.get('traceId'))
    return empty(c)
  },

  async remove(c: Context): Promise<Response> {
    const { query } = await parseRequest(c, fileRemoveRequestSchema, 'workspaceController.remove')
    await workspaceService.deleteFile(query.path, c.get('traceId'))
    return empty(c)
  },

  async createDirectory(c: Context): Promise<Response> {
    const { json } = await parseRequest(
      c,
      fileCreateDirectoryRequestSchema,
      'workspaceController.createDirectory',
    )
    await workspaceService.createDirectory(json.path, c.get('traceId'))
    return empty(c)
  },

  async rename(c: Context): Promise<Response> {
    const { json } = await parseRequest(c, fileRenameRequestSchema, 'workspaceController.rename')
    await workspaceService.renameFile(json.oldPath, json.newPath, c.get('traceId'))
    return empty(c)
  },

  async browse(c: Context): Promise<Response> {
    const { query } = await parseRequest(c, fileBrowseRequestSchema, 'workspaceController.browse')
    const entries = await workspaceService.browseDirs(query.path, c.get('traceId'))
    const folders = entries.filter((entry) => entry.type === 'directory')
    return ok(c, { path: query.path, folders })
  },

  async search(c: Context): Promise<Response> {
    const { query } = await parseRequest(c, fileSearchRequestSchema, 'workspaceController.search')
    const results = await workspaceService.searchFiles(query.project, query.q, c.get('traceId'))
    return ok(c, results)
  },
}
```

- [ ] **Step 5: Create `src/workspace/router.ts`**

```ts
import { Hono } from 'hono'
import { workspaceController } from './controller.js'

export const workspaceRouter = new Hono()

workspaceRouter.get('/', (c) => workspaceController.read(c))
workspaceRouter.put('/', (c) => workspaceController.write(c))
workspaceRouter.delete('/', (c) => workspaceController.remove(c))
workspaceRouter.post('/mkdir', (c) => workspaceController.createDirectory(c))
workspaceRouter.post('/rename', (c) => workspaceController.rename(c))
workspaceRouter.get('/browse', (c) => workspaceController.browse(c))
workspaceRouter.get('/search', (c) => workspaceController.search(c))
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/workspace
git commit -m "refactor(server): migrate workspace slice (merge FileService + WorkspaceService)"
```

---

## Task 6: Migrate `project/` slice

**Files:**
- Create: `src/project/types.ts`
- Create: `src/project/schema.ts`
- Create: `src/project/service.ts`
- Create: `src/project/controller.ts`
- Create: `src/project/router.ts`

- [ ] **Step 1: Create `src/project/types.ts`**

```ts
export interface ProjectEntry {
  id: string
  domain: string
  description?: string
  rootPath: string
  version?: string
  workflowCount?: number
  linked?: boolean
}

export interface LinkFile {
  sourcePath: string
  domain: string
  importedAt: string
}
```

- [ ] **Step 2: Create `src/project/schema.ts`**

```ts
import { z } from 'zod'

const projectIdSchema = z.object({
  id: z.string().min(1, 'Project id is required'),
})

export const projectCreateRequestSchema = {
  json: z.object({
    domain: z.string().min(1, 'Project domain is required'),
    description: z.string().optional(),
    targetPath: z.string().optional(),
  }),
}

export const projectByIdRequestSchema = {
  params: projectIdSchema,
}

export const projectImportRequestSchema = {
  json: z.object({
    path: z.string().min(1, 'Project path is required'),
  }),
}

export const projectExportRequestSchema = {
  params: projectIdSchema,
  json: z.object({
    targetPath: z.string().min(1, 'Export targetPath is required'),
  }),
}
```

- [ ] **Step 3: Create `src/project/service.ts`** (absorbs ExportService)

```ts
import fs from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import { CONFIG_FILE } from '@vnext-studio/workspace-service'
import { WorkspaceService } from '@workspace/service.js'
import type { ProjectEntry, LinkFile } from './types.js'

const PROJECTS_DIR = path.join(homedir(), 'vnext-projects')

export class ProjectService {
  constructor(private readonly workspaceService = new WorkspaceService()) {}

  async ensureProjectsDir(): Promise<void> {
    await fs.mkdir(PROJECTS_DIR, { recursive: true })
  }

  async resolveProjectPath(
    id: string,
    traceId?: string,
  ): Promise<{ projectPath: string; linked: boolean }> {
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      const linkRaw = await fs.readFile(linkPath, 'utf-8')
      const link = JSON.parse(linkRaw) as LinkFile
      return { projectPath: link.sourcePath, linked: true }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code && code !== 'ENOENT') {
        throw this.toProjectError(error, 'ProjectService.resolveProjectPath', traceId, { id, linkPath })
      }
    }
    return { projectPath: path.join(PROJECTS_DIR, id), linked: false }
  }

  async listProjects(traceId?: string): Promise<ProjectEntry[]> {
    await this.ensureProjectsDir()
    try {
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
      const projects: ProjectEntry[] = []
      const seenIds = new Set<string>()

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.link.json')) continue
        const id = entry.name.replace('.link.json', '')
        seenIds.add(id)
        try {
          const linkRaw = await fs.readFile(path.join(PROJECTS_DIR, entry.name), 'utf-8')
          const link = JSON.parse(linkRaw) as LinkFile
          projects.push(await this.toProjectEntry(id, link.sourcePath, true, traceId, link.domain))
        } catch {
          // Ignore invalid link files while listing the rest.
        }
      }

      for (const entry of entries) {
        if (!entry.isDirectory() || seenIds.has(entry.name)) continue
        const rootPath = path.join(PROJECTS_DIR, entry.name)
        projects.push(await this.toProjectEntry(entry.name, rootPath, false, traceId))
      }

      return projects
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.listProjects', traceId)
    }
  }

  async getProject(id: string, traceId?: string): Promise<ProjectEntry> {
    const { projectPath, linked } = await this.resolveProjectPath(id, traceId)
    try {
      const stat = await fs.stat(projectPath)
      if (!stat.isDirectory()) {
        throw new VnextForgeError(
          ERROR_CODES.PROJECT_NOT_FOUND,
          'Project directory was not found',
          { source: 'ProjectService.getProject', layer: 'application', details: { id, projectPath } },
          traceId,
        )
      }
    } catch (error) {
      if (error instanceof VnextForgeError) throw error
      throw this.toProjectError(error, 'ProjectService.getProject', traceId, { id, projectPath })
    }
    return this.toProjectEntry(id, projectPath, linked, traceId)
  }

  async createProject(
    domain: string,
    description?: string,
    targetPath?: string,
    traceId?: string,
  ): Promise<ProjectEntry> {
    await this.ensureProjectsDir()
    const rootPath = targetPath ? path.resolve(targetPath, domain) : path.join(PROJECTS_DIR, domain)

    try {
      await fs.access(rootPath)
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_ALREADY_EXISTS,
        'Project already exists',
        { source: 'ProjectService.createProject', layer: 'application', details: { domain, rootPath } },
        traceId,
      )
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (error instanceof VnextForgeError) throw error
      if (code && code !== 'ENOENT') {
        throw this.toProjectError(error, 'ProjectService.createProject', traceId, { domain, rootPath })
      }
    }

    try {
      await fs.mkdir(rootPath, { recursive: true })
      for (const componentPath of this.workspaceService.getComponentPaths(rootPath, domain)) {
        await fs.mkdir(componentPath, { recursive: true })
      }
      const config = this.workspaceService.createDefaultConfig(domain, description)
      await fs.writeFile(
        this.workspaceService.getConfigPath(rootPath),
        JSON.stringify(config, null, 2),
        'utf-8',
      )
      if (targetPath) {
        await this.writeLinkFile(domain, rootPath)
        return this.toProjectEntry(domain, rootPath, true, traceId)
      }
      return this.toProjectEntry(domain, rootPath, false, traceId)
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.createProject', traceId, { domain, rootPath })
    }
  }

  async importProject(sourcePath: string, traceId?: string): Promise<ProjectEntry> {
    const resolvedSource = path.resolve(sourcePath)
    let config
    try {
      config = await this.workspaceService.getConfig(resolvedSource, traceId)
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.importProject', traceId, { sourcePath: resolvedSource })
    }

    if (!config.domain) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'Workspace config must define a domain',
        {
          source: 'ProjectService.importProject',
          layer: 'application',
          details: { sourcePath: resolvedSource, configPath: path.join(resolvedSource, CONFIG_FILE) },
        },
        traceId,
      )
    }

    await this.ensureProjectsDir()
    await this.writeLinkFile(config.domain, resolvedSource)
    return this.toProjectEntry(config.domain, resolvedSource, true, traceId)
  }

  async getFileTree(id: string, traceId?: string) {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    return this.workspaceService.getFileTree(projectPath, traceId)
  }

  async getConfig(id: string, traceId?: string) {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    return this.workspaceService.getConfig(projectPath, traceId)
  }

  async exportProject(
    id: string,
    targetPath: string,
    traceId?: string,
  ): Promise<{ success: true; exportPath: string }> {
    const { projectPath } = await this.resolveProjectPath(id, traceId)
    try {
      await fs.cp(projectPath, targetPath, { recursive: true })
    } catch (error) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_SAVE_ERROR,
        error instanceof Error ? error.message : 'Project export failed',
        {
          source: 'ProjectService.exportProject',
          layer: 'infrastructure',
          details: { projectPath, targetPath },
        },
        traceId,
      )
    }
    return { success: true, exportPath: targetPath }
  }

  async removeProject(id: string, traceId?: string): Promise<{ success: boolean }> {
    await this.ensureProjectsDir()
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      await fs.unlink(linkPath)
      return { success: true }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code && code !== 'ENOENT') {
        throw this.toProjectError(error, 'ProjectService.removeProject', traceId, { id, linkPath })
      }
    }
    const directPath = path.join(PROJECTS_DIR, id)
    try {
      await fs.rm(directPath, { recursive: true })
      return { success: true }
    } catch (error) {
      throw this.toProjectError(error, 'ProjectService.removeProject', traceId, { id, directPath })
    }
  }

  private async writeLinkFile(domain: string, sourcePath: string): Promise<void> {
    const linkFile: LinkFile = { sourcePath, domain, importedAt: new Date().toISOString() }
    await fs.writeFile(
      path.join(PROJECTS_DIR, `${domain}.link.json`),
      JSON.stringify(linkFile, null, 2),
      'utf-8',
    )
  }

  private async toProjectEntry(
    id: string,
    rootPath: string,
    linked: boolean,
    traceId?: string,
    fallbackDomain?: string,
  ): Promise<ProjectEntry> {
    try {
      const config = await this.workspaceService.getConfig(rootPath, traceId)
      return { id, domain: config.domain || fallbackDomain || id, description: config.description, rootPath, version: config.version, linked }
    } catch {
      return { id, domain: fallbackDomain || id, rootPath, linked }
    }
  }

  private toProjectError(
    error: unknown,
    source: string,
    traceId?: string,
    details?: Record<string, unknown>,
  ): VnextForgeError {
    if (error instanceof VnextForgeError) return error
    const code = (error as NodeJS.ErrnoException | undefined)?.code

    if (code === 'ENOENT') {
      return new VnextForgeError(ERROR_CODES.PROJECT_NOT_FOUND, 'Project was not found', { source, layer: 'application', details }, traceId)
    }
    if (code === 'EEXIST') {
      return new VnextForgeError(ERROR_CODES.PROJECT_ALREADY_EXISTS, 'Project already exists', { source, layer: 'application', details }, traceId)
    }
    return new VnextForgeError(
      ERROR_CODES.PROJECT_LOAD_ERROR,
      error instanceof Error ? error.message : 'Project operation failed',
      { source, layer: 'application', details },
      traceId,
    )
  }
}
```

- [ ] **Step 4: Create `src/project/controller.ts`**

```ts
import type { Context } from 'hono'
import { parseRequest } from '@shared/lib/request.js'
import { ok, created, empty } from '@shared/lib/response.js'
import { ProjectService } from './service.js'
import {
  projectByIdRequestSchema,
  projectCreateRequestSchema,
  projectExportRequestSchema,
  projectImportRequestSchema,
} from './schema.js'

const projectService = new ProjectService()

export const projectController = {
  async list(c: Context): Promise<Response> {
    const projects = await projectService.listProjects(c.get('traceId'))
    return ok(c, projects)
  },

  async getById(c: Context): Promise<Response> {
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.getById')
    const project = await projectService.getProject(params.id, c.get('traceId'))
    return ok(c, project)
  },

  async create(c: Context): Promise<Response> {
    const { json } = await parseRequest(c, projectCreateRequestSchema, 'projectController.create')
    const project = await projectService.createProject(
      json.domain,
      json.description,
      json.targetPath,
      c.get('traceId'),
    )
    return created(c, project)
  },

  async importProject(c: Context): Promise<Response> {
    const { json } = await parseRequest(c, projectImportRequestSchema, 'projectController.importProject')
    const project = await projectService.importProject(json.path, c.get('traceId'))
    return ok(c, project)
  },

  async getTree(c: Context): Promise<Response> {
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.getTree')
    const tree = await projectService.getFileTree(params.id, c.get('traceId'))
    return ok(c, tree)
  },

  async getConfig(c: Context): Promise<Response> {
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.getConfig')
    const config = await projectService.getConfig(params.id, c.get('traceId'))
    return ok(c, config)
  },

  async exportProject(c: Context): Promise<Response> {
    const { params, json } = await parseRequest(c, projectExportRequestSchema, 'projectController.exportProject')
    const result = await projectService.exportProject(params.id, json.targetPath, c.get('traceId'))
    return ok(c, result)
  },

  async remove(c: Context): Promise<Response> {
    const { params } = await parseRequest(c, projectByIdRequestSchema, 'projectController.remove')
    await projectService.removeProject(params.id, c.get('traceId'))
    return empty(c)
  },
}
```

- [ ] **Step 5: Create `src/project/router.ts`**

```ts
import { Hono } from 'hono'
import { projectController } from './controller.js'

export const projectRouter = new Hono()

projectRouter.get('/', (c) => projectController.list(c))
projectRouter.get('/:id', (c) => projectController.getById(c))
projectRouter.post('/', (c) => projectController.create(c))
projectRouter.post('/import', (c) => projectController.importProject(c))
projectRouter.get('/:id/tree', (c) => projectController.getTree(c))
projectRouter.get('/:id/config', (c) => projectController.getConfig(c))
projectRouter.post('/:id/export', (c) => projectController.exportProject(c))
projectRouter.delete('/:id', (c) => projectController.remove(c))
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/project
git commit -m "refactor(server): migrate project slice (absorb ExportService)"
```

---

## Task 7: Update `index.ts` and delete old folders

**Files:**
- Modify: `src/index.ts`
- Delete: `src/controllers/`, `src/routes/`, `src/services/`, `src/middleware/`, `src/lib/`, `src/types/`

- [ ] **Step 1: Rewrite `src/index.ts`**

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ERROR_CODES, VnextForgeError } from '@vnext-studio/app-contracts'
import { errorHandler, jsonErrorResponse } from '@shared/middleware/error-handler.js'
import { traceIdMiddleware } from '@shared/middleware/trace-id.js'
import { ok } from '@shared/lib/response.js'
import { projectRouter } from '@project/router.js'
import { workspaceRouter } from '@workspace/router.js'
import { validateRouter } from '@validate/router.js'
import { runtimeProxyRouter } from '@runtime-proxy/router.js'
import { templateRouter } from '@template/router.js'
import '@shared/types/hono.js'

const app = new Hono()

app.use('*', traceIdMiddleware)
app.use('*', logger())
app.use('*', cors())

app.route('/api/projects', projectRouter)
app.route('/api/files', workspaceRouter)
app.route('/api/validate', validateRouter)
app.route('/api/runtime', runtimeProxyRouter)
app.route('/api/templates', templateRouter)

app.get('/api/health', (c) =>
  ok(c, { status: 'ok', traceId: c.get('traceId') }),
)

app.onError(errorHandler)
app.notFound((c) =>
  jsonErrorResponse(
    c,
    new VnextForgeError(
      ERROR_CODES.API_NOT_FOUND,
      'The requested route does not exist.',
      { source: 'app.notFound', layer: 'transport' },
      c.get('traceId'),
    ),
  ),
)

const port = Number(process.env.PORT) || 3001
console.log(`vnext-forge BFF running on port ${port}`)

serve({ fetch: app.fetch, port })

export type AppType = typeof app
export default app
```

- [ ] **Step 2: Delete old folders**

```bash
rm -rf apps/server/src/controllers
rm -rf apps/server/src/routes
rm -rf apps/server/src/services
rm -rf apps/server/src/middleware
rm -rf apps/server/src/lib
rm -rf apps/server/src/types
```

- [ ] **Step 3: Build to verify TypeScript compiles cleanly**

```bash
cd apps/server && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run existing tests**

```bash
cd apps/server && pnpm test
```

Expected: all tests pass (middleware tests in `src/shared/middleware/*.test.ts` — note: existing test files still reference old import paths; update them if they fail).

> If tests fail due to import path changes, update the import in the test file:
> - `from '../error-handler.js'` → `from './error-handler.js'` (tests co-located with source in `shared/middleware/`)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "refactor(server): wire slice routers in index.ts, remove old folder structure"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** shared/, template, validate, runtime-proxy, workspace, project slices all covered. tsconfig aliases updated. index.ts rewritten. Old folders deleted.
- [x] **Placeholder scan:** No TBDs. All code blocks are complete.
- [x] **Type consistency:** `ok/created/empty` used consistently from `@shared/lib/response.js`. `WorkspaceService` used in `project/service.ts` via `@workspace/service.js`. `ProjectEntry`/`LinkFile` defined in `project/types.ts` and imported by `project/service.ts`.
- [x] **ExportService absorption:** `fs.cp` logic inlined directly into `ProjectService.exportProject` in Task 6.
