# Server Vertical Slice Architecture Design

**Date:** 2026-04-03  
**Scope:** `apps/server` — migration from horizontal-layer to vertical slice, DDD-like structure  
**Status:** Approved

---

## Context

The current server is organized horizontally:

```
src/
  controllers/   ← per-domain sub-folders (file, project, validate, runtime-proxy, template)
  routes/        ← thin Hono route definitions that delegate to controllers
  services/      ← business logic (FileService, ProjectService, WorkspaceService, ExportService)
  middleware/    ← error-handler, trace-id
  lib/           ← request.ts
  types/         ← Hono context augmentation
```

This creates unnecessary indirection: a single HTTP operation spans three folders. The goal is to move to vertical slices where each domain concern is fully self-contained.

---

## Decisions

| Question | Decision |
|---|---|
| What happens to `routes/`? | Removed entirely — each slice exports its own `router.ts` |
| How are slices defined? | Domain/bounded-context based (not HTTP-resource based) |
| Internal slice structure | Flat: `router.ts`, `controller.ts`, `service.ts`, `schema.ts`, `types.ts` |
| Shared infrastructure location | `shared/` (not `_shared/`) at `src/shared/` |

---

## Target Folder Structure

```
apps/server/src/
  project/
    router.ts       ← Hono router exported for index.ts
    controller.ts   ← HTTP handlers
    service.ts      ← ProjectService (domain logic, no Hono dependency)
    schema.ts       ← Zod request schemas
    types.ts        ← ProjectEntry, LinkFile

  workspace/
    router.ts
    controller.ts   ← merged FileController + WorkspaceController
    service.ts      ← merged FileService + WorkspaceService → single WorkspaceService
    schema.ts
    types.ts        ← SearchResult, DirectoryEntry

  validate/
    router.ts
    controller.ts
    service.ts      ← workflow-system package integration
    schema.ts

  runtime-proxy/
    router.ts
    controller.ts   ← no service needed (pure proxy)
    schema.ts

  template/
    router.ts
    controller.ts
    schema.ts

  shared/
    middleware/
      error-handler.ts
      trace-id.ts
    lib/
      request.ts
      response.ts   ← NEW: ok(), created(), empty() helper functions
    types/
      hono.ts

  index.ts          ← app bootstrap + slice router mounts
```

---

## Internal Slice Pattern

Every slice follows the same internal conventions.

### `router.ts`
Creates and exports a Hono instance. Binds routes to controller methods.

```ts
import { Hono } from 'hono'
import { projectController } from './controller.js'

const projectRouter = new Hono()
projectRouter.get('/', (c) => projectController.list(c))
projectRouter.get('/:id', (c) => projectController.getById(c))
// ...

export { projectRouter }
```

### `controller.ts`
HTTP parsing + service call + response. Uses `ok/created/empty` from `shared/lib/response.ts`. No `baseController` spread.

```ts
import { ok, created, empty } from '@shared/lib/response.js'
import { parseRequest } from '@shared/lib/request.js'
import { projectService } from './service.js'
import { projectCreateRequestSchema } from './schema.js'

export const projectController = {
  async list(c: Context) {
    const projects = await projectService.listProjects(c.get('traceId'))
    return ok(c, projects)
  },
  async create(c: Context) {
    const { json } = await parseRequest(c, projectCreateRequestSchema, 'projectController.create')
    const project = await projectService.createProject(json.domain, json.description, json.targetPath, c.get('traceId'))
    return created(c, project)
  }
}
```

### `service.ts`
Pure business logic. No Hono dependency. Throws `VnextForgeError`, never catches HTTP concerns.

### `schema.ts`
Zod schemas for this slice's HTTP contract only. No cross-slice schema imports.

### `types.ts`
Types specific to this slice. Does not duplicate types from `@vnext-forge-studio/app-contracts` or `@vnext-forge-studio/types`.

---

## `workspace/` Merge Strategy

`FileService` and `WorkspaceService` are merged into a single `WorkspaceService` in `workspace/service.ts`. The merge is logical: both operate on the file system within a project root.

`project/service.ts` imports from `workspace/service.ts` — this cross-slice dependency is intentional and acceptable: `workspace` is infrastructure-level, `project` is domain-level.

```ts
// project/service.ts
import { WorkspaceService } from '@workspace/service.js'
```

---

## `shared/lib/response.ts`

Replaces the `baseController` object pattern with plain exported functions:

```ts
import type { Context } from 'hono'
import { success } from '@vnext-studio/app-contracts'

export const ok = <T>(c: Context, data: T) => c.json(success(data))
export const created = <T>(c: Context, data: T) => c.json(success(data), 201)
export const empty = (c: Context) => c.json(success(null))
```

---

## `index.ts` — Route Mounting

URL paths are preserved — the web layer (`apps/web`) is unaffected.

```ts
import { projectRouter } from '@project/router.js'
import { workspaceRouter } from '@workspace/router.js'
import { validateRouter } from '@validate/router.js'
import { runtimeProxyRouter } from '@runtime-proxy/router.js'
import { templateRouter } from '@template/router.js'

app.route('/api/projects', projectRouter)
app.route('/api/files', workspaceRouter)
app.route('/api/validate', validateRouter)
app.route('/api/runtime', runtimeProxyRouter)
app.route('/api/templates', templateRouter)
```

---

## tsconfig Path Aliases

```json
{
  "paths": {
    "@project/*": ["src/project/*"],
    "@workspace/*": ["src/workspace/*"],
    "@validate/*": ["src/validate/*"],
    "@runtime-proxy/*": ["src/runtime-proxy/*"],
    "@template/*": ["src/template/*"],
    "@shared/*": ["src/shared/*"]
  }
}
```

Existing aliases (`@controllers/*`, `@routes/*`, `@services/*`) are removed.

---

## `ExportService` Placement

`ExportService` contains a single method (`exportAsVnext`) that copies a project directory. This is a project-domain operation — it moves to `project/service.ts` as a private method of `ProjectService`, removing the separate class entirely.

---

## What Gets Deleted

| Path | Reason |
|---|---|
| `src/controllers/` | Merged into slice `controller.ts` files |
| `src/routes/` | Replaced by slice `router.ts` files |
| `src/services/` | Merged into slice `service.ts` files |

`src/middleware/`, `src/lib/`, `src/types/` contents move to `src/shared/` — same code, new location.

---

## Migration Order

1. Create `src/shared/` — copy middleware, lib, types; update imports
2. Migrate `template/` slice (simplest — no service)
3. Migrate `validate/` slice
4. Migrate `runtime-proxy/` slice
5. Migrate `workspace/` slice (merge FileService + WorkspaceService)
6. Migrate `project/` slice (depends on workspace service)
7. Update `index.ts` — mount slice routers, remove old route imports
8. Delete `src/controllers/`, `src/routes/`, `src/services/`
9. Update `tsconfig.json` path aliases
10. Run build + tests
