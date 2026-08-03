# monitoring — Project Context

App: `apps/monitoring/` — `@vnext-forge-studio/monitoring`
Dev server: `pnpm --filter @vnext-forge-studio/monitoring dev` → port **3100**
Repo-wide rules: [`CLAUDE.md`](../../../CLAUDE.md) at the repo root;
setup / run / build details: [`README.md`](../../../README.md) → "Monitoring App".

This file holds decisions specific to the monitoring app. Do not repeat
repo-wide concerns here (dependency policy, error taxonomy, trace headers,
language policy) — reference the root `CLAUDE.md` instead.

---

## Directory Layout Note

Monitoring now lives inside the `vnext-forge` repository; the docs that used to
sit in a separate `monitoring-ui/` root were moved into this folder. There is
**no** separate "docs root" anymore:

```
apps/monitoring/
  src/                      # application code
  docs/
    CLAUDE.md               # this file — monitoring-specific project context
    features/               # per-feature design / decision notes
    superpowers/specs/      # spec documents
    ask-correctness/        # correctness & security log (see below)
    YYYY-MM-DD-*.md         # dated design notes
```

The full code structure (app / pages / modules / shared) is documented in the
README under "Monitoring App → Project structure"; it is not duplicated here.

---

## Architecture Decisions

### Folder Structure: Vertical Slice

The `app / modules / pages / shared` layering model is used.

- Every monitoring feature lives under `modules/` as its own slice
- Slices do not import each other; shared code moves under `shared/`
- `pages/` holds route entry and composition only — business logic lives in `modules/`
- `shared/` stays narrow; generic infrastructure (api, config, lib) lives there
- Imports use the `@monitoring/*` alias (no deep relative paths)

One current deviation: `modules/definitions/workflow/WorkflowDetailPage.tsx`
imports `useInstanceList` and `instance-columns` from `modules/instances/`.
This is a violation of the rule, not a deliberate exception — next time a
similar need comes up, move the shared piece into `shared/` instead.

### designer-ui Integration: Selective Imports

`DesignerUiProvider` is **not used** — it carries forge-specific dependencies
(LSP capabilities, Monaco loader, forge ApiTransport). Instead:

- UI primitives: imported directly from the `@vnext-forge-studio/designer-ui/ui` subpath
- Hooks: `@vnext-forge-studio/designer-ui/hooks`
- Theme: `DocumentThemeSync` is mounted on its own (`app/AppProviders.tsx`)
- Notifications: `registerNotificationSink` + sonner (`app/notifications/SonnerProvider.tsx`)
- Styles: `@vnext-forge-studio/designer-ui/styles.css` is imported from `index.css`
- **Component icons**: icons for vNext component types come from the
  `@vnext-forge-studio/designer-ui/component-icons` subpath (`workflowIcon`,
  `taskIcon`, `functionIcon`, `extensionIcon`, `schemaIcon`, `viewIcon` plus
  `VNEXT_FOLDER_PALETTE` / `getFileColors`). When the UI shows a component type,
  use these official icons rather than lucide-react. The monitoring-side wrapper
  is `shared/components/ComponentBadgeIcon.tsx`.
  Note: the `FILE_BADGE_SVG` mapping inside designer-ui is private to
  `ComponentFileIcon.tsx` (not exported) — do not rely on it; use the subpath
  exports.
- **Read-only detail cores**: the six component detail pages render the shared
  read-only designers from the designer-ui root barrel — `TaskDetailCore`,
  `ExtensionDetailCore`, `FunctionDetailCore`, `MappingDetailCore`,
  `SchemaDetailCore`, `ViewDetailCore` (module:
  `packages/designer-ui/src/modules/component-readonly/`). Each core mounts
  `FormReadOnlyProvider` itself and normalizes both the flattened monitor-API
  shape and the canonical `attributes.*` nesting — pages pass the raw
  `useComponentDetail` data straight through. Never build editable designer
  panels here; monitoring stays read-only.
- **View preview**: the view content preview lives *inside* the Designer tab —
  `ViewDetailCore` renders a Preview / Raw toggle and branches by view type
  (HTML in a sandboxed iframe, Markdown, JSON, link target). There is no
  separate "Visual Preview" page tab. The pseudo-ui renderer is injected by
  `ViewDetailPage` through the core's `renderPseudoUiPreview` prop — it renders
  `PseudoUiViewSurface` from `@vnext-forge-studio/designer-ui/quickrun`
  (`mode="preview"`, no provider needed) with the `ViewResponse` built by
  `modules/definitions/view/buildViewResponse.ts`. The core must never import
  quick-run itself (bundle-safety contract).
- **Skeletons**: loading states come from `@monitoring/shared/components/skeletons`
  (`DetailPageSkeleton`, `KpiCardSkeleton`, `ChartSkeleton`) plus `DataTable`'s
  built-in skeleton rows (`isLoading`) and refetch dim (`isFetching`). New
  screens should reuse these instead of "Loading…" text.

### API Client: MonitoringHttpClient

The `ApiTransport` interface is **not adopted** — it is bound to the forge method
registry (`getMethodHttpSpec`), which does not fit the monitoring APIs.

Instead, the endpoint-based `MonitoringHttpClient` in `shared/api/api-client.ts`
is used:
- `get(path, params)` / `post(path, body)` → `Promise<ApiResponse<T>>`
- The `ApiResponse<T>` envelope comes from `@vnext-forge-studio/app-contracts`;
  HTTP errors are normalized into an `ApiFailure` by `api-envelope.ts` (30s timeout)
- Every request gets `X-Trace-Id` + `traceparent` headers injected (`trace-headers.ts`)
- Base URL: `config.apiBaseUrl` = `VITE_MONITORING_API_BASE_URL`.
  **The default is an empty string** → requests go out relative, and in dev the
  Vite proxy forwards `/api/*` to `http://localhost:4203`. There is no proxy in a
  production build, so the variable must be set at build time.

Never hand-write paths; use the `shared/api/monitoring-api.ts` helpers:

| Helper | Path it builds |
|--------|----------------|
| `domainGet` / `domainPost` | `/api/v1.0/monitor/{domain}{path}` |
| `workflowGet` | `/api/v1.0/monitor/{domain}/workflows/{workflow}{path}` |
| `instanceGet` | `/api/v1.0/monitor/{domain}/workflows/{workflow}/instances/{id}{path}` |
| `monitorGet` | `/api/v1.0/{path}` (endpoints without a domain scope, e.g. `config`) |

These helpers apply `unwrap()`: they `throw` on an `ApiFailure` and return `data`
on success. So TanStack Query hooks see `data` directly, and error handling goes
through the query's `error` state.

### Server State: TanStack Query

`shared/api/query-client.ts` sets up the single `QueryClient` instance:
`staleTime: 30s`, `retry: 1`, `refetchOnWindowFocus: false`. Slices declare their
hooks in their own `api/*-queries.ts` files; components never fetch.

### Tables and URL State

List screens use the TanStack Table–based `DataTable` family under
`shared/components/data-table/` (`DataTableToolbar`, `DataTablePagination`,
`DataTableAdvancedFilter`, `DataTableQueryParamFilter`). Table state (page,
filters, column visibility) is written to the URL via `useTableUrlState.ts` +
`table-state-url.ts`. When adding a new list, use this module instead of writing
your own filter/state mechanism.

The time range filter is app-wide and singular: `shared/time-range/`
(`useGlobalTimeRange`, `buildTimeRangeFilter`, `presets.ts`, plus
`useLargeRangeGuard` + `LargeRangeAlert` for the large-range warning).

### Config Singleton

`import.meta.env` is read only inside `shared/config/config.ts`. The rest of the
app always goes through `import { config } from '@monitoring/shared/config/config'`.

There are two keys, both optional: `VITE_MONITORING_API_BASE_URL` (default:
empty → Vite proxy) and `VITE_MONITORING_DOMAIN` (default: `core`; a warning is
logged when it is unset).

### Logging

Use `createLogger('monitoring/ModuleName')` (from the
`@vnext-forge-studio/designer-ui` barrel) instead of `console.*`. The startup
warning in `config.ts` is the only exception.

### Tests

Run with `vitest`: `pnpm --filter @vnext-forge-studio/monitoring test`.
Test files sit next to their source and are named `*.vitest.test.ts`
(e.g. `shared/components/data-table/filter-validate.vitest.test.ts`).

### Language Policy

All UI copy and code comments must be in English (`vnext-forge` project policy).

---

## Route Structure (careful: singular vs plural)

As defined in `AppRouter.tsx`:

| Route | Page |
|---|---|
| `/` | `DashboardPage` |
| `/definitions/:type` | `DefinitionsPage` — `:type` is **singular**: `workflow`, `task`, `function`, `view`, `extension`, `schema`, `mapping` |
| `/definitions/:type/:id` | `ComponentDetailPage` |
| `/definitions/workflows/:wfId/instances/:instanceId` | `InstanceDetailPage` — here the segment is **plural** (`workflows`) and literal |
| `/jobs`, `/faults`, `/config` | `JobsPage`, `FaultsPage`, `ConfigPage` |
| `*` | `NotFoundPage` |

Sidebar links are generated from `DEFINITION_TYPES` (singular keys), while
instance links are built by hand as
`` `/definitions/workflows/${flow}/instances/${id}` ``. Do not mix up the two
shapes when adding a new link.

**Known dead code**: `pages/HomePage.tsx` and `pages/InstanceListPage.tsx` are
not attached to any route and are not imported anywhere. The instance list is
rendered on the workflow detail page through the `modules/instances/` slice.

---

## Git Policy

**The user makes the git commits.** Claude must never run `git commit`,
`git push`, or any other git write command. When a phase or a meaningful unit of
work is done, suggesting "this looks like a good point to commit" is fine, but
committing must never happen automatically.

---

## Component Response Structure (Definitions API)

All component types (`sys-flows`, `sys-tasks`, `sys-functions`, `sys-mappings`, `sys-extensions`, `sys-schemas`, `sys-views`) carry the same **common fields**:

```json
{
  "key": "component-id",
  "flow": "sys-flows",
  "flowVersion": "1.0.0",
  "domain": "banking",
  "version": "1.0.0",
  "tags": ["banking", "account", "onboarding"],
  "_comment": "Component description"
}
```

**Additional fields** per component type (shown on the Definitions page):
- **Workflow** (`sys-flows`): `labels[]`, `type` (F/C/S/P)
- **Task** (`sys-tasks`): `type` (1-16 → DaprHttpEndpoint, HttpTask, ScriptTask, …)
- **Function** (`sys-functions`): `scope` (D/F/I → Domain/Flow/Instance), `labels[]`
- **Mapping** (`sys-mappings`): `name`
- **Extension** (`sys-extensions`): `type`, `scope` (D/F/I), `labels[]`
- **Schema** (`sys-schemas`): `type`, `labels[]`
- **View** (`sys-views`): `type` (1-6 → JSON, HTML, Markdown, Deeplink, Http, URN), `display`, `renderer`, `labels[]`

The mapping between the singular `:type` route values and the API's `sys-*` flow
names lives in `modules/definitions/api/definitions-queries.ts`
(`workflow → sys-flows`, `task → sys-tasks`, …).

### Type & Scope Mappings

**Task Types** (`sys-tasks`): 1→DaprHttpEndpoint, 2→DaprBinding, 3→DaprService, 4→DaprPubSub, 5→HumanTask, 6→HttpTask, 7→ScriptTask, 8→ConditionTask, 9→TimerTask, 10→NotificationTask, 11→StartFlowTask, 12→TriggerTransitionTask, 13→GetInstanceDataTask, 14→SubProcessTask, 15→GetInstancesTask, 16→SoapTask

**View Types** (`sys-views`): 1→JSON, 2→HTML, 3→Markdown, 4→Deeplink, 5→Http, 6→URN

**Scope** (`sys-functions`, `sys-extensions`): D→Domain, F→Flow, I→Instance

---

## Monitor API — Pagination

Every list endpoint returns the same envelope:

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "hasNext": true
  },
  "items": [ ... ]
}
```

### Rules

- `pagination` is not always present. When aggregating with the `groupBy` parameter, the `pagination` field is absent from the response entirely — not `null`, simply missing.
- `hasNext` tells you whether there is a next page. A total record count (`totalCount`) is never returned.
- `page` is 1-based (first page = 1).
- `pageSize` echoes the `?pageSize=` value you sent; on the last page `items` may contain fewer entries than `pageSize`.

### Query Parameters

| Parameter | Default | Max |
|-----------|---------|-----|
| `page` | 1 | 1000 |
| `pageSize` | 10 | 100 |

### "Next Page" Flow

```
hasNext == true  →  call again with page + 1
hasNext == false →  you are on the last page
```

---

## Running and Package Manager

`pnpm` (9.15.0, root `package.json` → `packageManager`) is used directly:

```bash
pnpm install                                          # at the repo root
pnpm --filter @vnext-forge-studio/monitoring dev      # port 3100
pnpm --filter @vnext-forge-studio/monitoring build    # tsc -b + vite build → dist/
pnpm --filter @vnext-forge-studio/monitoring test
pnpm --filter @vnext-forge-studio/monitoring lint
```

On a machine where `pnpm` is not on `PATH`, run it through Corepack:
`corepack pnpm --filter @vnext-forge-studio/monitoring dev`.

From VS Code: Run and Debug → **Monitoring: Dev Server + Chrome** (`F5`) starts
the dev server and opens Chrome in debug mode. For the server only,
Terminal → Run Task → **Monitoring: Dev Server**; for a build,
**Monitoring: Build**. The definitions live in `.vscode/launch.json` and
`.vscode/tasks.json`.

---

## Correctness & Security Log (`docs/ask-correctness/`)

Anything whose correctness is uncertain, whose approval is questionable, or that
carries a security risk is recorded under
`apps/monitoring/docs/ask-correctness/` (the folder is created with the first
entry).

### When to record

- Decisions you are not certain about (API behavior, edge cases, data interpretation)
- Implementations that could open a security hole (XSS, injection, auth bypass, data leakage)
- Work built on assumptions (backend docs missing, spec unclear)
- Technical debt that may cause problems later

### File Naming

```
apps/monitoring/docs/ask-correctness/YYYY-MM-DD-topic-summary.md
```

Example: `apps/monitoring/docs/ask-correctness/2026-06-18-pagination-null-vs-missing.md`

### File Template

```markdown
# [Topic Title]

**Date:** YYYY-MM-DD
**Category:** correctness | security | assumption | tech-debt
**Related file(s):** `path/to/file.ts`

## Situation

[What was done / what was observed]

## Doubt / Risk

[Why it needs confirmation, what could go wrong]

## Expected Confirmation

[From whom / what kind of answer is expected]

## Resolution (closed once filled in)

[Approved / rejected / changed — what was done]
```

### Rule

If Claude runs into one of the categories above during an implementation, it
creates the corresponding file and tells the user. A topic stays open until the
file is closed (the Resolution section filled in).
