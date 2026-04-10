# Server Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `workspace-service` package and transform `apps/server` to use `ApiResponse<T>` + `VnextForgeError` throughout, with proper middleware and responsibility separation.

**Architecture:** `workspace-service` owns workspace directory reading/analysis; `apps/server` owns the project registry and HTTP layer. A single `error-handler` middleware in the server translates all `VnextForgeError` throws into typed `ApiFailure` responses. Route handlers contain no `try/catch` — they call services and return `ok(data)`.

**Tech Stack:** Hono v4, Node.js `fs/promises`, TypeScript ESM, `@vnext-studio/app-contracts`, vitest

---

## File Map

**packages/workspace-service:**
- `package.json` — add exports, app-contracts dep, vitest
- `src/interfaces/workspace.ts` — NEW: IWorkspace, WorkspaceConfig and sub-types
- `src/interfaces/workspace-tree.ts` — NEW: FileTreeNode, WorkspaceStructure
- `src/paths/constants.ts` — NEW: CONFIG_FILE, COMPONENT_DIRS
- `src/paths/resolver.ts` — NEW: resolveConfigPath, resolveComponentPath
- `src/paths/resolver.test.ts` — NEW
- `src/analyzer/types.ts` — NEW: WorkspaceAnalysisResult
- `src/analyzer/workspace-analyzer.ts` — NEW: WorkspaceAnalyzer class
- `src/analyzer/workspace-analyzer.test.ts` — NEW
- `src/index.ts` — NEW: public exports

**apps/server:**
- `package.json` — add @vnext-studio/app-contracts, @vnext-studio/workspace-service, vitest
- `src/middleware/trace-id.ts` — NEW
- `src/middleware/trace-id.test.ts` — NEW
- `src/middleware/error-handler.ts` — NEW
- `src/middleware/error-handler.test.ts` — NEW
- `src/lib/response.ts` — NEW: ok() helper
- `src/services/workspace.service.ts` — NEW
- `src/services/file.service.ts` — MODIFY: VnextForgeError
- `src/services/project.service.ts` — MODIFY: use WorkspaceService, VnextForgeError
- `src/routes/files.ts` — MODIFY: ApiResponse<T>, no try/catch
- `src/routes/projects.ts` — MODIFY: ApiResponse<T>, no try/catch
- `src/routes/templates.ts` — MODIFY: ApiResponse<T>
- `src/routes/validate.ts` — MODIFY: ApiResponse<T>
- `src/routes/runtime-proxy.ts` — MODIFY: VnextForgeError on fetch failure
- `src/index.ts` — MODIFY: middleware order, AppType, notFound

---

## Task 1: Build app-contracts (prerequisite)

`app-contracts` has no `dist/` — workspace packages that import from it need it built first.

**Files:** `packages/app-contracts/package.json`

- [ ] **Step 1: Build app-contracts**

```bash
cd c:/CalismaAlani/Burgan/vnext-forge
pnpm --filter @vnext-studio/app-contracts build
```

Expected: `packages/app-contracts/dist/` directory created with `index.js`, `index.d.ts`.

---

## Task 2: workspace-service — package setup + vitest

**Files:**
- Modify: `packages/workspace-service/package.json`
- Create: `packages/workspace-service/vitest.config.ts`

- [ ] **Step 1: Update package.json**

Replace the full content of `packages/workspace-service/package.json`:

```json
{
  "name": "@vnext-studio/workspace-service",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Workspace rules, interfaces, and path conventions.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@vnext-studio/app-contracts": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Install new dependency**

```bash
cd c:/CalismaAlani/Burgan/vnext-forge
pnpm install
```

Expected: `vitest` and `@vnext-studio/app-contracts` symlink appear in `packages/workspace-service/node_modules`.

---

## Task 3: workspace-service — interfaces

Types only — no runtime code, no tests needed.

**Files:**
- Create: `packages/workspace-service/src/interfaces/workspace.ts`
- Create: `packages/workspace-service/src/interfaces/workspace-tree.ts`

- [ ] **Step 1: Create workspace.ts**

```typescript
// packages/workspace-service/src/interfaces/workspace.ts

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

- [ ] **Step 2: Create workspace-tree.ts**

```typescript
// packages/workspace-service/src/interfaces/workspace-tree.ts

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

---

## Task 4: workspace-service — paths

**Files:**
- Create: `packages/workspace-service/src/paths/constants.ts`
- Create: `packages/workspace-service/src/paths/resolver.ts`
- Create: `packages/workspace-service/src/paths/resolver.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/workspace-service/src/paths/resolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveConfigPath, resolveComponentPath } from './resolver.js'
import path from 'node:path'

describe('resolveConfigPath', () => {
  it('returns vnext.config.json path inside workspace root', () => {
    const result = resolveConfigPath('/projects/my-workspace')
    expect(result).toBe(path.join('/projects/my-workspace', 'vnext.config.json'))
  })
})

describe('resolveComponentPath', () => {
  it('returns component dir path inside workspace root/domain', () => {
    const result = resolveComponentPath('/projects/my-workspace', 'MyDomain', 'Workflows')
    expect(result).toBe(path.join('/projects/my-workspace', 'MyDomain', 'Workflows'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd c:/CalismaAlani/Burgan/vnext-forge
pnpm --filter @vnext-studio/workspace-service test
```

Expected: FAIL — `Cannot find module './resolver.js'`

- [ ] **Step 3: Create constants.ts**

```typescript
// packages/workspace-service/src/paths/constants.ts

export const CONFIG_FILE = 'vnext.config.json' as const

export const COMPONENT_DIRS = [
  'Workflows',
  'Mappings',
  'Schemas',
  'Tasks',
  'Views',
  'Functions',
  'Extensions',
] as const

export type ComponentDir = (typeof COMPONENT_DIRS)[number]
```

- [ ] **Step 4: Create resolver.ts**

```typescript
// packages/workspace-service/src/paths/resolver.ts
import path from 'node:path'
import { CONFIG_FILE } from './constants.js'

export function resolveConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, CONFIG_FILE)
}

export function resolveComponentPath(
  workspaceRoot: string,
  domain: string,
  component: string,
): string {
  return path.join(workspaceRoot, domain, component)
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter @vnext-studio/workspace-service test
```

Expected: PASS — 2 tests

---

## Task 5: workspace-service — WorkspaceAnalyzer

**Files:**
- Create: `packages/workspace-service/src/analyzer/types.ts`
- Create: `packages/workspace-service/src/analyzer/workspace-analyzer.ts`
- Create: `packages/workspace-service/src/analyzer/workspace-analyzer.test.ts`

- [ ] **Step 1: Create analyzer/types.ts**

```typescript
// packages/workspace-service/src/analyzer/types.ts
import type { WorkspaceConfig } from '../interfaces/workspace.js'
import type { FileTreeNode } from '../interfaces/workspace-tree.js'

export interface WorkspaceAnalysisResult {
  rootPath: string;
  config: WorkspaceConfig | null;
  configValid: boolean;
  tree: FileTreeNode;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// packages/workspace-service/src/analyzer/workspace-analyzer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkspaceAnalyzer } from './workspace-analyzer.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { VnextForgeError } from '@vnext-studio/app-contracts'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-analyzer-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('WorkspaceAnalyzer.readConfig', () => {
  it('reads and returns a valid vnext.config.json', async () => {
    const config = {
      version: '1.0.0',
      domain: 'TestDomain',
      runtimeVersion: '0.0.33',
      schemaVersion: '0.0.33',
      paths: {
        componentsRoot: 'TestDomain',
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
        visibility: 'private' as const,
        metadata: {},
      },
      dependencies: { domains: [], npm: [] },
      referenceResolution: { enabled: true, validateOnBuild: true, strictMode: false },
    }

    await fs.writeFile(
      path.join(tmpDir, 'vnext.config.json'),
      JSON.stringify(config),
      'utf-8',
    )

    const analyzer = new WorkspaceAnalyzer()
    const result = await analyzer.readConfig(tmpDir)

    expect(result.domain).toBe('TestDomain')
    expect(result.version).toBe('1.0.0')
  })

  it('throws VnextForgeError FILE_NOT_FOUND when config is missing', async () => {
    const analyzer = new WorkspaceAnalyzer()
    await expect(analyzer.readConfig(tmpDir)).rejects.toBeInstanceOf(VnextForgeError)
    await expect(analyzer.readConfig(tmpDir)).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' })
  })

  it('throws VnextForgeError PROJECT_INVALID_CONFIG when config has invalid JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'vnext.config.json'), 'not-json', 'utf-8')
    const analyzer = new WorkspaceAnalyzer()
    await expect(analyzer.readConfig(tmpDir)).rejects.toMatchObject({ code: 'PROJECT_INVALID_CONFIG' })
  })
})

describe('WorkspaceAnalyzer.buildTree', () => {
  it('returns a FileTreeNode tree for the directory', async () => {
    await fs.mkdir(path.join(tmpDir, 'Workflows'))
    await fs.writeFile(path.join(tmpDir, 'Workflows', 'flow.json'), '{}', 'utf-8')

    const analyzer = new WorkspaceAnalyzer()
    const tree = await analyzer.buildTree(tmpDir)

    expect(tree.type).toBe('directory')
    expect(tree.children?.some((c) => c.name === 'Workflows')).toBe(true)
  })
})

describe('WorkspaceAnalyzer.analyze', () => {
  it('returns configValid: false when config is missing', async () => {
    const analyzer = new WorkspaceAnalyzer()
    const result = await analyzer.analyze(tmpDir)
    expect(result.configValid).toBe(false)
    expect(result.config).toBeNull()
  })

  it('returns configValid: true when config is present', async () => {
    const config = {
      version: '1.0.0',
      domain: 'D',
      runtimeVersion: '0.0.33',
      schemaVersion: '0.0.33',
      paths: { componentsRoot: 'D', tasks: 'Tasks', views: 'Views', functions: 'Functions', extensions: 'Extensions', workflows: 'Workflows', schemas: 'Schemas', mappings: 'Mappings' },
      exports: { functions: [], workflows: [], tasks: [], views: [], schemas: [], extensions: [], visibility: 'private', metadata: {} },
      dependencies: { domains: [], npm: [] },
      referenceResolution: { enabled: true, validateOnBuild: true, strictMode: false },
    }
    await fs.writeFile(path.join(tmpDir, 'vnext.config.json'), JSON.stringify(config), 'utf-8')

    const analyzer = new WorkspaceAnalyzer()
    const result = await analyzer.analyze(tmpDir)
    expect(result.configValid).toBe(true)
    expect(result.config?.domain).toBe('D')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter @vnext-studio/workspace-service test
```

Expected: FAIL — `Cannot find module './workspace-analyzer.js'`

- [ ] **Step 4: Create workspace-analyzer.ts**

```typescript
// packages/workspace-service/src/analyzer/workspace-analyzer.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'
import type { WorkspaceConfig } from '../interfaces/workspace.js'
import type { FileTreeNode } from '../interfaces/workspace-tree.js'
import type { WorkspaceAnalysisResult } from './types.js'
import { resolveConfigPath } from '../paths/resolver.js'

export class WorkspaceAnalyzer {
  async readConfig(rootPath: string): Promise<WorkspaceConfig> {
    const configPath = resolveConfigPath(rootPath)

    let raw: string
    try {
      raw = await fs.readFile(configPath, 'utf-8')
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException).code
      throw new VnextForgeError(
        code === 'EACCES' ? ERROR_CODES.FILE_PERMISSION_DENIED : ERROR_CODES.FILE_NOT_FOUND,
        `Config not found at ${configPath}`,
        { source: 'WorkspaceAnalyzer.readConfig', layer: 'infrastructure', details: { configPath } },
      )
    }

    try {
      return JSON.parse(raw) as WorkspaceConfig
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        `Invalid JSON in ${configPath}`,
        { source: 'WorkspaceAnalyzer.readConfig', layer: 'infrastructure', details: { configPath } },
      )
    }
  }

  async buildTree(rootPath: string): Promise<FileTreeNode> {
    return this._buildNode(rootPath, path.basename(rootPath))
  }

  private async _buildNode(dirPath: string, name: string): Promise<FileTreeNode> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const children: FileTreeNode[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        children.push(await this._buildNode(fullPath, entry.name))
      } else {
        children.push({ name: entry.name, path: fullPath, type: 'file' })
      }
    }

    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return { name, path: dirPath, type: 'directory', children }
  }

  async analyze(rootPath: string): Promise<WorkspaceAnalysisResult> {
    const tree = await this.buildTree(rootPath)

    let config: WorkspaceConfig | null = null
    let configValid = false

    try {
      config = await this.readConfig(rootPath)
      configValid = true
    } catch {
      // config absent or invalid — still return a result
    }

    return { rootPath, config, configValid, tree }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @vnext-studio/workspace-service test
```

Expected: PASS — all tests in resolver.test.ts and workspace-analyzer.test.ts

---

## Task 6: workspace-service — index.ts + build

**Files:**
- Create: `packages/workspace-service/src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// packages/workspace-service/src/index.ts

export type {
  WorkspaceConfig,
  WorkspacePaths,
  WorkspaceExports,
  WorkspaceDependencies,
  ReferenceResolutionConfig,
  IWorkspace,
  WorkspaceMetadata,
} from './interfaces/workspace.js'

export type { FileTreeNode, WorkspaceStructure } from './interfaces/workspace-tree.js'

export { CONFIG_FILE, COMPONENT_DIRS } from './paths/constants.js'
export type { ComponentDir } from './paths/constants.js'

export { resolveConfigPath, resolveComponentPath } from './paths/resolver.js'

export type { WorkspaceAnalysisResult } from './analyzer/types.js'
export { WorkspaceAnalyzer } from './analyzer/workspace-analyzer.js'
```

- [ ] **Step 2: Build workspace-service**

```bash
cd c:/CalismaAlani/Burgan/vnext-forge
pnpm --filter @vnext-studio/workspace-service build
```

Expected: `packages/workspace-service/dist/` created. No TypeScript errors.

---

## Task 7: server — package.json + vitest setup

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/vitest.config.ts`

- [ ] **Step 1: Update package.json**

Replace the full content of `apps/server/package.json`:

```json
{
  "name": "@vnext-studio/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "start": "node dist/index.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@hono/node-server": "^1.14.0",
    "@vnext-studio/app-contracts": "workspace:*",
    "@vnext-studio/types": "workspace:*",
    "@vnext-studio/workspace-service": "workspace:*",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "eslint-import-resolver-typescript": "^4.4.4",
    "eslint-plugin-import": "^2.32.0",
    "eslint-plugin-promise": "^7.2.1",
    "eslint-plugin-unused-imports": "^4.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
// apps/server/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Install dependencies**

```bash
cd c:/CalismaAlani/Burgan/vnext-forge
pnpm install
```

Expected: `@vnext-studio/app-contracts` and `@vnext-studio/workspace-service` symlinks appear in `apps/server/node_modules`.

---

## Task 8: server — trace-id middleware

**Files:**
- Create: `apps/server/src/middleware/trace-id.ts`
- Create: `apps/server/src/middleware/trace-id.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/middleware/trace-id.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { traceIdMiddleware } from './trace-id.js'

describe('traceIdMiddleware', () => {
  it('sets X-Trace-Id response header', async () => {
    const app = new Hono()
    app.use('*', traceIdMiddleware)
    app.get('/test', (c) => c.json({ ok: true }))

    const res = await app.request('/test')
    expect(res.headers.get('X-Trace-Id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('stores traceId in context accessible by handlers', async () => {
    const app = new Hono<{ Variables: { traceId: string } }>()
    app.use('*', traceIdMiddleware)
    app.get('/test', (c) => c.json({ traceId: c.get('traceId') }))

    const res = await app.request('/test')
    const body = await res.json() as { traceId: string }
    expect(body.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('header traceId matches context traceId', async () => {
    const app = new Hono<{ Variables: { traceId: string } }>()
    app.use('*', traceIdMiddleware)
    app.get('/test', (c) => c.json({ traceId: c.get('traceId') }))

    const res = await app.request('/test')
    const body = await res.json() as { traceId: string }
    expect(res.headers.get('X-Trace-Id')).toBe(body.traceId)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd c:/CalismaAlani/Burgan/vnext-forge
pnpm --filter @vnext-studio/server test
```

Expected: FAIL — `Cannot find module './trace-id.js'`

- [ ] **Step 3: Create trace-id.ts**

```typescript
// apps/server/src/middleware/trace-id.ts
import type { MiddlewareHandler } from 'hono'

export const traceIdMiddleware: MiddlewareHandler = async (c, next) => {
  const traceId = crypto.randomUUID()
  c.set('traceId', traceId)
  await next()
  c.header('X-Trace-Id', traceId)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @vnext-studio/server test
```

Expected: PASS — 3 tests

---

## Task 9: server — error-handler middleware

**Files:**
- Create: `apps/server/src/middleware/error-handler.ts`
- Create: `apps/server/src/middleware/error-handler.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/middleware/error-handler.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'
import type { ApiFailure } from '@vnext-studio/app-contracts'
import { errorHandler } from './error-handler.js'
import { traceIdMiddleware } from './trace-id.js'

function buildApp(handler: (c: Context) => Response | Promise<Response>) {
  const app = new Hono()
  app.use('*', traceIdMiddleware)
  app.get('/test', handler)
  app.onError(errorHandler)
  return app
}

describe('errorHandler', () => {
  it('returns 404 for FILE_NOT_FOUND', async () => {
    const app = buildApp(() => {
      throw new VnextForgeError(
        ERROR_CODES.FILE_NOT_FOUND,
        'test msg',
        { source: 'Test.fn', layer: 'infrastructure' },
      )
    })
    const res = await app.request('/test')
    expect(res.status).toBe(404)

    const body = await res.json() as ApiFailure
    expect(body.success).toBe(false)
    expect(body.data).toBeNull()
    expect(body.error.code).toBe('FILE_NOT_FOUND')
  })

  it('returns 404 for PROJECT_NOT_FOUND', async () => {
    const app = buildApp(() => {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_NOT_FOUND,
        'test msg',
        { source: 'Test.fn', layer: 'application' },
      )
    })
    const res = await app.request('/test')
    expect(res.status).toBe(404)
  })

  it('returns 400 for API_BAD_REQUEST', async () => {
    const app = buildApp(() => {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'bad input',
        { source: 'Test.fn', layer: 'transport' },
      )
    })
    const res = await app.request('/test')
    expect(res.status).toBe(400)
  })

  it('returns 500 for unknown errors with INTERNAL_UNEXPECTED code', async () => {
    const app = buildApp(() => { throw new Error('boom') })
    const res = await app.request('/test')
    expect(res.status).toBe(500)

    const body = await res.json() as ApiFailure
    expect(body.error.code).toBe('INTERNAL_UNEXPECTED')
  })

  it('returns 502 for RUNTIME_CONNECTION_FAILED', async () => {
    const app = buildApp(() => {
      throw new VnextForgeError(
        ERROR_CODES.RUNTIME_CONNECTION_FAILED,
        'runtime down',
        { source: 'Test.fn', layer: 'infrastructure' },
      )
    })
    const res = await app.request('/test')
    expect(res.status).toBe(502)
  })

  it('preserves traceId in error response', async () => {
    const app = buildApp(() => {
      throw new VnextForgeError(
        ERROR_CODES.API_BAD_REQUEST,
        'bad',
        { source: 'Test.fn', layer: 'transport' },
        'fixed-trace-id',
      )
    })
    const res = await app.request('/test')
    const body = await res.json() as ApiFailure
    expect(body.error.traceId).toBe('fixed-trace-id')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @vnext-studio/server test
```

Expected: FAIL — `Cannot find module './error-handler.js'`

- [ ] **Step 3: Create error-handler.ts**

```typescript
// apps/server/src/middleware/error-handler.ts
import type { ErrorHandler } from 'hono'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'
import type { ApiFailure, ErrorCode } from '@vnext-studio/app-contracts'

const STATUS_MAP: Partial<Record<ErrorCode, number>> = {
  FILE_NOT_FOUND: 404,
  PROJECT_NOT_FOUND: 404,
  API_NOT_FOUND: 404,
  FILE_INVALID_PATH: 400,
  API_BAD_REQUEST: 400,
  FILE_PERMISSION_DENIED: 403,
  API_FORBIDDEN: 403,
  API_UNAUTHORIZED: 401,
  API_CONFLICT: 409,
  PROJECT_ALREADY_EXISTS: 409,
  API_UNPROCESSABLE: 422,
  RUNTIME_NOT_AVAILABLE: 502,
  RUNTIME_CONNECTION_FAILED: 502,
  RUNTIME_EXECUTION_FAILED: 502,
  RUNTIME_TIMEOUT: 502,
  RUNTIME_INVALID_RESPONSE: 502,
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof VnextForgeError) {
    console.error('[error]', JSON.stringify(err.toLogEntry()))
    const userMessage = err.toUserMessage()
    const status = STATUS_MAP[err.code] ?? 500
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: userMessage.code,
          message: userMessage.message,
          traceId: userMessage.traceId ?? c.get('traceId'),
        },
      } satisfies ApiFailure,
      status,
    )
  }

  console.error('[error] unexpected', err)
  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: ERROR_CODES.INTERNAL_UNEXPECTED,
        message: 'An unexpected error occurred. Please try again or contact support.',
        traceId: c.get('traceId'),
      },
    } satisfies ApiFailure,
    500,
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @vnext-studio/server test
```

Expected: PASS — all middleware tests

---

## Task 10: server — lib/response.ts

No test needed — trivial wrapper; covered indirectly by route tests.

**Files:**
- Create: `apps/server/src/lib/response.ts`

- [ ] **Step 1: Create response.ts**

```typescript
// apps/server/src/lib/response.ts
import type { ApiSuccess, ResponseMeta } from '@vnext-studio/app-contracts'

export function ok<T>(data: T, meta?: ResponseMeta): ApiSuccess<T> {
  if (meta !== undefined) {
    return { success: true, data, error: null, meta }
  }
  return { success: true, data, error: null }
}
```

---

## Task 11: server — workspace.service.ts

**Files:**
- Create: `apps/server/src/services/workspace.service.ts`

- [ ] **Step 1: Create workspace.service.ts**

```typescript
// apps/server/src/services/workspace.service.ts
import { WorkspaceAnalyzer } from '@vnext-studio/workspace-service'
import type { WorkspaceConfig, FileTreeNode, WorkspaceAnalysisResult } from '@vnext-studio/workspace-service'

export class WorkspaceService {
  private readonly analyzer = new WorkspaceAnalyzer()

  async readConfig(rootPath: string, traceId?: string): Promise<WorkspaceConfig> {
    return this.analyzer.readConfig(rootPath)
  }

  async buildTree(rootPath: string): Promise<FileTreeNode> {
    return this.analyzer.buildTree(rootPath)
  }

  async analyze(rootPath: string): Promise<WorkspaceAnalysisResult> {
    return this.analyzer.analyze(rootPath)
  }
}
```

> Note: `traceId` parameter is accepted for future use (attach to errors if needed). `WorkspaceAnalyzer` already throws typed `VnextForgeError` — no further wrapping needed.

---

## Task 12: server — file.service.ts (VnextForgeError)

**Files:**
- Modify: `apps/server/src/services/file.service.ts`

- [ ] **Step 1: Replace file.service.ts**

```typescript
// apps/server/src/services/file.service.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'

function mapFsError(e: unknown, filePath: string, source: string): VnextForgeError {
  const code = (e as NodeJS.ErrnoException).code
  const errorCode =
    code === 'ENOENT' ? ERROR_CODES.FILE_NOT_FOUND :
    code === 'EACCES' ? ERROR_CODES.FILE_PERMISSION_DENIED :
    code === 'EEXIST' ? ERROR_CODES.FILE_ALREADY_EXISTS :
    ERROR_CODES.FILE_READ_ERROR
  return new VnextForgeError(
    errorCode,
    `File operation failed: ${filePath}`,
    { source, layer: 'infrastructure', details: { filePath, fsCode: code } },
  )
}

export class FileService {
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (e) {
      throw mapFsError(e, filePath, 'FileService.readFile')
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (e) {
      throw mapFsError(e, filePath, 'FileService.writeFile')
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.rm(filePath, { recursive: true })
    } catch (e) {
      throw mapFsError(e, filePath, 'FileService.deleteFile')
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (e) {
      throw mapFsError(e, dirPath, 'FileService.createDirectory')
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath)
    } catch (e) {
      throw mapFsError(e, oldPath, 'FileService.renameFile')
    }
  }

  async browseDirs(dirPath: string): Promise<{ name: string; path: string; hasVnextConfig: boolean }[]> {
    try {
      const { readdir, stat } = fs
      const { join } = path
      const { homedir } = await import('node:os')
      const targetPath = dirPath || homedir()

      const entries = await readdir(targetPath, { withFileTypes: true })
      const folders: { name: string; path: string; hasVnextConfig: boolean }[] = []

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        const fullPath = join(targetPath, entry.name)
        let hasVnextConfig = false
        try {
          await stat(join(fullPath, 'vnext.config.json'))
          hasVnextConfig = true
        } catch { /* no config */ }
        folders.push({ name: entry.name, path: fullPath, hasVnextConfig })
      }

      return folders.sort((a, b) => a.name.localeCompare(b.name))
    } catch (e) {
      throw mapFsError(e, dirPath, 'FileService.browseDirs')
    }
  }

  async searchFiles(projectPath: string, query: string): Promise<{ path: string; line: number; text: string }[]> {
    const results: { path: string; line: number; text: string }[] = []
    await this._searchDir(projectPath, query.toLowerCase(), results)
    return results.slice(0, 100)
  }

  private async _searchDir(dirPath: string, query: string, results: { path: string; line: number; text: string }[]) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await this._searchDir(fullPath, query, results)
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
        } catch { /* skip unreadable */ }
      }
    }
  }
}
```

---

## Task 13: server — project.service.ts (use WorkspaceService + VnextForgeError)

**Files:**
- Modify: `apps/server/src/services/project.service.ts`

- [ ] **Step 1: Replace project.service.ts**

```typescript
// apps/server/src/services/project.service.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'
import type { IWorkspace, WorkspaceConfig, FileTreeNode } from '@vnext-studio/workspace-service'
import { COMPONENT_DIRS, CONFIG_FILE } from '@vnext-studio/workspace-service'
import { WorkspaceService } from './workspace.service.js'

const PROJECTS_DIR = path.join(os.homedir(), 'vnext-projects')

interface LinkFile {
  sourcePath: string;
  domain: string;
  importedAt: string;
}

export interface ProjectEntry extends IWorkspace {
  id: string;
  linked: boolean;
}

export class ProjectService {
  private readonly workspaceService = new WorkspaceService()

  private async ensureProjectsDir(): Promise<void> {
    await fs.mkdir(PROJECTS_DIR, { recursive: true })
  }

  private async resolveProjectPath(id: string): Promise<{ projectPath: string; linked: boolean }> {
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      const raw = await fs.readFile(linkPath, 'utf-8')
      const link = JSON.parse(raw) as LinkFile
      return { projectPath: link.sourcePath, linked: true }
    } catch {
      return { projectPath: path.join(PROJECTS_DIR, id), linked: false }
    }
  }

  async listProjects(traceId?: string): Promise<ProjectEntry[]> {
    await this.ensureProjectsDir()
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true })
    const projects: ProjectEntry[] = []
    const seenIds = new Set<string>()

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.link.json')) continue
      const id = entry.name.replace('.link.json', '')
      seenIds.add(id)
      try {
        const raw = await fs.readFile(path.join(PROJECTS_DIR, entry.name), 'utf-8')
        const link = JSON.parse(raw) as LinkFile
        const result = await this.workspaceService.analyze(link.sourcePath)
        projects.push({
          id,
          domain: result.config?.domain ?? link.domain ?? id,
          description: result.config?.description,
          rootPath: link.sourcePath,
          version: result.config?.version,
          linked: true,
        })
      } catch { /* skip invalid link */ }
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || seenIds.has(entry.name)) continue
      const projectPath = path.join(PROJECTS_DIR, entry.name)
      const result = await this.workspaceService.analyze(projectPath)
      projects.push({
        id: entry.name,
        domain: result.config?.domain ?? entry.name,
        description: result.config?.description,
        rootPath: projectPath,
        version: result.config?.version,
        linked: false,
      })
    }

    return projects
  }

  async getProject(id: string, traceId?: string): Promise<ProjectEntry> {
    const { projectPath, linked } = await this.resolveProjectPath(id)

    try {
      await fs.stat(projectPath)
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_NOT_FOUND,
        `Project not found: ${id}`,
        { source: 'ProjectService.getProject', layer: 'application', details: { id } },
        traceId,
      )
    }

    const result = await this.workspaceService.analyze(projectPath)
    return {
      id,
      domain: result.config?.domain ?? id,
      description: result.config?.description,
      rootPath: projectPath,
      version: result.config?.version,
      linked,
    }
  }

  async createProject(
    domain: string,
    description?: string,
    targetPath?: string,
    traceId?: string,
  ): Promise<ProjectEntry> {
    await this.ensureProjectsDir()
    const projectPath = targetPath
      ? path.resolve(targetPath, domain)
      : path.join(PROJECTS_DIR, domain)

    await fs.mkdir(projectPath, { recursive: true })

    for (const dir of COMPONENT_DIRS) {
      await fs.mkdir(path.join(projectPath, domain, dir), { recursive: true })
    }

    const config: WorkspaceConfig = {
      version: '1.0.0',
      domain,
      description: description ?? '',
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

    await fs.writeFile(
      path.join(projectPath, CONFIG_FILE),
      JSON.stringify(config, null, 2),
    )

    if (targetPath) {
      const linkFile: LinkFile = { sourcePath: projectPath, domain, importedAt: new Date().toISOString() }
      await fs.writeFile(
        path.join(PROJECTS_DIR, `${domain}.link.json`),
        JSON.stringify(linkFile, null, 2),
      )
      return { id: domain, domain, description, rootPath: projectPath, version: '1.0.0', linked: true }
    }

    return { id: domain, domain, description, rootPath: projectPath, version: '1.0.0', linked: false }
  }

  async importProject(sourcePath: string, traceId?: string): Promise<ProjectEntry> {
    const resolved = path.resolve(sourcePath)
    const config = await this.workspaceService.readConfig(resolved)

    if (!config.domain) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'vnext.config.json must have a "domain" field',
        { source: 'ProjectService.importProject', layer: 'application', details: { sourcePath: resolved } },
        traceId,
      )
    }

    await this.ensureProjectsDir()
    const linkFile: LinkFile = { sourcePath: resolved, domain: config.domain, importedAt: new Date().toISOString() }
    await fs.writeFile(
      path.join(PROJECTS_DIR, `${config.domain}.link.json`),
      JSON.stringify(linkFile, null, 2),
    )

    return {
      id: config.domain,
      domain: config.domain,
      description: config.description,
      rootPath: resolved,
      version: config.version,
      linked: true,
    }
  }

  async getFileTree(id: string, traceId?: string): Promise<FileTreeNode> {
    const { projectPath } = await this.resolveProjectPath(id)
    return this.workspaceService.buildTree(projectPath)
  }

  async getConfig(id: string, traceId?: string): Promise<WorkspaceConfig> {
    const { projectPath } = await this.resolveProjectPath(id)
    return this.workspaceService.readConfig(projectPath)
  }

  async exportProject(id: string, targetPath: string, traceId?: string): Promise<{ exportPath: string }> {
    const { projectPath } = await this.resolveProjectPath(id)
    try {
      await fs.cp(projectPath, targetPath, { recursive: true })
    } catch (e) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_SAVE_ERROR,
        `Export failed for project ${id}`,
        { source: 'ProjectService.exportProject', layer: 'application', details: { id, targetPath } },
        traceId,
      )
    }
    return { exportPath: targetPath }
  }

  async removeProject(id: string, traceId?: string): Promise<void> {
    await this.ensureProjectsDir()
    const linkPath = path.join(PROJECTS_DIR, `${id}.link.json`)
    try {
      await fs.unlink(linkPath)
      return
    } catch { /* no link file */ }

    const dirPath = path.join(PROJECTS_DIR, id)
    try {
      await fs.rm(dirPath, { recursive: true })
    } catch {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_NOT_FOUND,
        `Project not found: ${id}`,
        { source: 'ProjectService.removeProject', layer: 'application', details: { id } },
        traceId,
      )
    }
  }
}
```

---

## Task 14: server — update all routes

**Files:**
- Modify: `apps/server/src/routes/files.ts`
- Modify: `apps/server/src/routes/projects.ts`
- Modify: `apps/server/src/routes/templates.ts`
- Modify: `apps/server/src/routes/validate.ts`
- Modify: `apps/server/src/routes/runtime-proxy.ts`

- [ ] **Step 1: Replace routes/files.ts**

```typescript
// apps/server/src/routes/files.ts
import { Hono } from 'hono'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'
import { FileService } from '../services/file.service.js'
import { ok } from '../lib/response.js'
import { homedir } from 'node:os'

export const fileRoutes = new Hono()
const fileService = new FileService()

fileRoutes.get('/', async (c) => {
  const filePath = c.req.query('path')
  if (!filePath) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'query param "path" is required',
      { source: 'fileRoutes.get', layer: 'transport' },
      c.get('traceId'),
    )
  }
  const content = await fileService.readFile(filePath)
  return c.json(ok({ path: filePath, content }))
})

fileRoutes.put('/', async (c) => {
  const body = await c.req.json<{ path?: string; content?: string }>()
  if (!body.path || body.content === undefined) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'body must include "path" and "content"',
      { source: 'fileRoutes.put', layer: 'transport' },
      c.get('traceId'),
    )
  }
  await fileService.writeFile(body.path, body.content)
  return c.json(ok({ path: body.path }))
})

fileRoutes.delete('/', async (c) => {
  const filePath = c.req.query('path')
  if (!filePath) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'query param "path" is required',
      { source: 'fileRoutes.delete', layer: 'transport' },
      c.get('traceId'),
    )
  }
  await fileService.deleteFile(filePath)
  return c.json(ok({ path: filePath }))
})

fileRoutes.post('/mkdir', async (c) => {
  const body = await c.req.json<{ path?: string }>()
  if (!body.path) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'body must include "path"',
      { source: 'fileRoutes.mkdir', layer: 'transport' },
      c.get('traceId'),
    )
  }
  await fileService.createDirectory(body.path)
  return c.json(ok({ path: body.path }))
})

fileRoutes.post('/rename', async (c) => {
  const body = await c.req.json<{ oldPath?: string; newPath?: string }>()
  if (!body.oldPath || !body.newPath) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'body must include "oldPath" and "newPath"',
      { source: 'fileRoutes.rename', layer: 'transport' },
      c.get('traceId'),
    )
  }
  await fileService.renameFile(body.oldPath, body.newPath)
  return c.json(ok({ oldPath: body.oldPath, newPath: body.newPath }))
})

fileRoutes.get('/browse', async (c) => {
  const dirPath = c.req.query('path') ?? homedir()
  const folders = await fileService.browseDirs(dirPath)
  return c.json(ok({ path: dirPath, folders }))
})

fileRoutes.get('/search', async (c) => {
  const query = c.req.query('q')
  const projectPath = c.req.query('project')
  if (!query || !projectPath) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'query params "q" and "project" are required',
      { source: 'fileRoutes.search', layer: 'transport' },
      c.get('traceId'),
    )
  }
  const results = await fileService.searchFiles(projectPath, query)
  return c.json(ok(results))
})
```

- [ ] **Step 2: Replace routes/projects.ts**

```typescript
// apps/server/src/routes/projects.ts
import { Hono } from 'hono'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'
import { ProjectService } from '../services/project.service.js'
import { ok } from '../lib/response.js'

export const projectRoutes = new Hono()
const projectService = new ProjectService()

projectRoutes.get('/', async (c) => {
  const projects = await projectService.listProjects(c.get('traceId'))
  return c.json(ok(projects))
})

projectRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const project = await projectService.getProject(id, c.get('traceId'))
  return c.json(ok(project))
})

projectRoutes.post('/', async (c) => {
  const body = await c.req.json<{ domain?: string; description?: string; targetPath?: string }>()
  if (!body.domain) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'body must include "domain"',
      { source: 'projectRoutes.create', layer: 'transport' },
      c.get('traceId'),
    )
  }
  const project = await projectService.createProject(body.domain, body.description, body.targetPath, c.get('traceId'))
  return c.json(ok(project), 201)
})

projectRoutes.post('/import', async (c) => {
  const body = await c.req.json<{ path?: string }>()
  if (!body.path) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'body must include "path"',
      { source: 'projectRoutes.import', layer: 'transport' },
      c.get('traceId'),
    )
  }
  const project = await projectService.importProject(body.path, c.get('traceId'))
  return c.json(ok(project))
})

projectRoutes.get('/:id/tree', async (c) => {
  const id = c.req.param('id')
  const tree = await projectService.getFileTree(id, c.get('traceId'))
  return c.json(ok(tree))
})

projectRoutes.get('/:id/config', async (c) => {
  const id = c.req.param('id')
  const config = await projectService.getConfig(id, c.get('traceId'))
  return c.json(ok(config))
})

projectRoutes.post('/:id/export', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ targetPath?: string }>()
  if (!body.targetPath) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'body must include "targetPath"',
      { source: 'projectRoutes.export', layer: 'transport' },
      c.get('traceId'),
    )
  }
  const result = await projectService.exportProject(id, body.targetPath, c.get('traceId'))
  return c.json(ok(result))
})

projectRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await projectService.removeProject(id, c.get('traceId'))
  return c.json(ok({ id }))
})
```

- [ ] **Step 3: Replace routes/templates.ts**

```typescript
// apps/server/src/routes/templates.ts
import { Hono } from 'hono'
import { ok } from '../lib/response.js'

const TEMPLATES = [
  { id: 'basic-flow', name: 'Basic Flow', type: 'F', description: 'Simple workflow: initial → processing → completed/error' },
  { id: 'subflow', name: 'SubFlow', type: 'S', description: 'Reusable sub-workflow with parameter passing' },
  { id: 'subprocess', name: 'SubProcess', type: 'P', description: 'Independent parallel process' },
  { id: 'approval-flow', name: 'Approval Flow', type: 'F', description: 'Approval: pending → approve/reject + timeout' },
  { id: 'saga-flow', name: 'Saga/Compensation', type: 'F', description: 'Compensation pattern with rollback' },
  { id: 'event-driven', name: 'Event-Driven Flow', type: 'F', description: 'PubSub event-based workflow' },
  { id: 'scheduled-flow', name: 'Scheduled/Timer Flow', type: 'F', description: 'Timer-based workflow (expire, timeout)' },
  { id: 'wizard-flow', name: 'Wizard Flow', type: 'F', description: 'Step-by-step wizard with stateType=5' },
  { id: 'cdc-worker', name: 'CDC Worker', type: 'F', description: 'Background data synchronization' },
  { id: 'multi-factor-auth', name: 'Multi-Factor Auth', type: 'F', description: 'Multi-factor authentication flow' },
  { id: 'crud-state-machine', name: 'CRUD State Machine', type: 'F', description: 'draft → active → passive lifecycle' },
  { id: 'transaction-flow', name: 'Transaction Flow', type: 'F', description: 'Authorization → Capture pattern' },
] as const

export const templateRoutes = new Hono()

templateRoutes.get('/', (c) => c.json(ok(TEMPLATES)))
```

- [ ] **Step 4: Replace routes/validate.ts**

```typescript
// apps/server/src/routes/validate.ts
import { Hono } from 'hono'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'
import { ok } from '../lib/response.js'

export const validateRoutes = new Hono()

validateRoutes.post('/', async (c) => {
  const body = await c.req.json<{ workflow?: unknown }>()
  if (!body.workflow) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      'body must include "workflow"',
      { source: 'validateRoutes.post', layer: 'transport' },
      c.get('traceId'),
    )
  }
  // TODO: wire up workflow-system validation engine (separate task)
  return c.json(ok({ valid: true, errors: [], warnings: [] }))
})
```

- [ ] **Step 5: Replace routes/runtime-proxy.ts**

```typescript
// apps/server/src/routes/runtime-proxy.ts
import { Hono } from 'hono'
import { VnextForgeError, ERROR_CODES } from '@vnext-studio/app-contracts'

export const runtimeProxyRoutes = new Hono()

runtimeProxyRoutes.all('/*', async (c) => {
  const runtimeUrl = c.req.header('X-Runtime-Url') ?? 'http://localhost:4201'
  const routePath = c.req.path.replace('/api/runtime', '')
  const query = c.req.query()
  const queryString = new URLSearchParams(query).toString()
  const fullUrl = queryString ? `${runtimeUrl}${routePath}?${queryString}` : `${runtimeUrl}${routePath}`

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const method = c.req.method
    const options: RequestInit = { method, headers }
    if (method !== 'GET' && method !== 'HEAD') {
      try { options.body = await c.req.text() } catch { /* no body */ }
    }
    const response = await fetch(fullUrl, options)
    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch (e) {
    throw new VnextForgeError(
      ERROR_CODES.RUNTIME_CONNECTION_FAILED,
      `Could not reach runtime at ${runtimeUrl}`,
      { source: 'runtimeProxyRoutes', layer: 'infrastructure', details: { runtimeUrl, path: routePath } },
      c.get('traceId'),
    )
  }
})
```

---

## Task 15: server — index.ts (wire up)

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Replace index.ts**

```typescript
// apps/server/src/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ERROR_CODES } from '@vnext-studio/app-contracts'
import type { ApiFailure } from '@vnext-studio/app-contracts'
import { projectRoutes } from './routes/projects.js'
import { fileRoutes } from './routes/files.js'
import { runtimeProxyRoutes } from './routes/runtime-proxy.js'
import { validateRoutes } from './routes/validate.js'
import { templateRoutes } from './routes/templates.js'
import { traceIdMiddleware } from './middleware/trace-id.js'
import { errorHandler } from './middleware/error-handler.js'

const app = new Hono()

// ── Global middleware ────────────────────────────────────────────────────────
app.use('*', traceIdMiddleware)
app.use('*', logger())
app.use('*', cors())

// ── Routes ───────────────────────────────────────────────────────────────────
app.route('/api/projects', projectRoutes)
app.route('/api/files', fileRoutes)
app.route('/api/runtime', runtimeProxyRoutes)
app.route('/api/validate', validateRoutes)
app.route('/api/templates', templateRoutes)

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// ── Error handling ───────────────────────────────────────────────────────────
app.onError(errorHandler)

app.notFound((c) =>
  c.json(
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
  ),
)

// ── Server ───────────────────────────────────────────────────────────────────
export type AppType = typeof app

const port = Number(process.env.PORT) || 3001
console.log(`vnext-forge BFF running on port ${port}`)
serve({ fetch: app.fetch, port })

export default app
```

- [ ] **Step 2: Run all server tests**

```bash
cd c:/CalismaAlani/Burgan/vnext-forge
pnpm --filter @vnext-studio/server test
```

Expected: PASS — all middleware tests

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm --filter @vnext-studio/server build
```

Expected: no TypeScript errors, `dist/` created

- [ ] **Step 4: Smoke test the server**

```bash
pnpm --filter @vnext-studio/server dev &
sleep 2
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/no-such-route
kill %1
```

Expected outputs:
- `/api/health` → `{"status":"ok"}`
- `/api/no-such-route` → `{"success":false,"data":null,"error":{"code":"API_NOT_FOUND","message":"The requested route does not exist."}}`
