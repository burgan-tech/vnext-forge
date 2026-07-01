# vNext Monitoring — Phase 1: Foundation + App Shell + Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish TanStack Query, all shared domain types, app shell (sidebar + topbar + layout), full routing scaffold with placeholder pages for every route, and a fully functional Dashboard page.

**Architecture:** Vertical slice under `apps/monitoring/src`. Every page lives inside `AppShell` (sidebar 224px fixed + topbar 52px sticky + scrollable canvas). TanStack Query v5 handles server state; `MonitoringHttpClient` is the fetch adapter. Shared types live in `shared/types/`. UI primitives are imported from `@vnext-forge-studio/designer-ui/ui`. All colors use Tailwind semantic tokens from the designer-ui theme — no hardcoded hex except for the always-dark sidebar (uses Tailwind `slate-*`).

**Tech Stack:** React 19, Vite 6, Tailwind 4, React Router v7, TanStack Query v5, Zustand 5, lucide-react, @vnext-forge-studio/designer-ui

---

## File Map

```
apps/monitoring/
├── package.json                                    MODIFY: add @tanstack/react-query ^5
├── src/
│   ├── vite-env.d.ts                               MODIFY: add VITE_MONITORING_DOMAIN
│   ├── shared/
│   │   ├── config/config.ts                        MODIFY: add domain field
│   │   ├── types/
│   │   │   ├── domain.ts                           NEW
│   │   │   ├── instance.ts                         NEW
│   │   │   ├── workflow.ts                         NEW
│   │   │   ├── execution.ts                        NEW
│   │   │   ├── job.ts                              NEW
│   │   │   ├── definition.ts                       NEW
│   │   │   └── index.ts                            NEW
│   │   ├── api/
│   │   │   ├── query-client.ts                     NEW
│   │   │   └── monitoring-api.ts                   NEW (domain-aware wrappers)
│   │   └── components/
│   │       └── StatusBadge.tsx                     NEW
│   ├── app/
│   │   ├── AppProviders.tsx                        MODIFY: add QueryClientProvider
│   │   ├── AppRouter.tsx                           MODIFY: full route tree + AppLayout
│   │   ├── layout/
│   │   │   ├── AppShell.tsx                        NEW
│   │   │   ├── Sidebar.tsx                         NEW
│   │   │   ├── Topbar.tsx                          NEW
│   │   │   └── breadcrumb-utils.ts                 NEW
│   │   └── favorites/
│   │       └── useFavorites.ts                     NEW
│   ├── modules/
│   │   └── dashboard/
│   │       ├── api/dashboard-queries.ts            NEW
│   │       └── components/
│   │           ├── KpiCard.tsx                     NEW
│   │           ├── ComponentCountsSection.tsx      NEW
│   │           ├── InstanceDistSection.tsx         NEW
│   │           ├── ActivityChart.tsx               NEW
│   │           └── RecentFaultsSection.tsx         NEW
│   └── pages/
│       ├── DashboardPage.tsx                       MODIFY: real content
│       ├── DefinitionsPage.tsx                     NEW (placeholder)
│       ├── ComponentDetailPage.tsx                 NEW (placeholder)
│       ├── InstanceListPage.tsx                    NEW (placeholder)
│       ├── InstanceDetailPage.tsx                  NEW (placeholder)
│       ├── TaskExecutionsPage.tsx                  NEW (placeholder)
│       ├── TaskExecutionDetailPage.tsx             NEW (placeholder)
│       ├── FunctionExecutionsPage.tsx              NEW (placeholder)
│       ├── FunctionExecutionDetailPage.tsx         NEW (placeholder)
│       ├── JobsPage.tsx                            NEW (placeholder)
│       ├── FaultsPage.tsx                          NEW (placeholder)
│       └── ConfigPage.tsx                          NEW (placeholder)
```

---

## Context for All Tasks

Working directory: `apps/monitoring/` inside the `vnext-forge` monorepo.

Run TypeScript check: `corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit`
Run install: `corepack pnpm install`

Import alias `@monitoring` resolves to `apps/monitoring/src/`.

Designer-ui imports:
- UI components: `import { Badge, Button, Input } from '@vnext-forge-studio/designer-ui/ui'`
- cn utility: `import { cn } from '@monitoring/shared/lib/utils'` (re-exports from designer-ui/lib)
- Logger: `import { createLogger } from '@vnext-forge-studio/designer-ui'`

**Color conventions:**
- Semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) come from designer-ui theme — use these for all content areas.
- Sidebar is always dark — use Tailwind `slate-*` palette directly (`bg-slate-900`, `text-slate-100`, etc.).
- Instance status color mapping to Badge variant:
  - Active → `info`
  - Busy → `warning`
  - Completed → `success`
  - Faulted → `destructive`
  - Suspended → `outline` with `className="border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400"`
  - Terminated → `muted`

---

### Task 1: TanStack Query + QueryClient + AppProviders

**Files:**
- Modify: `apps/monitoring/package.json`
- Create: `apps/monitoring/src/shared/api/query-client.ts`
- Modify: `apps/monitoring/src/app/AppProviders.tsx`

- [ ] **Step 1: Add @tanstack/react-query to package.json**

Edit `apps/monitoring/package.json`, add to `"dependencies"`:
```json
"@tanstack/react-query": "^5.0.0"
```

- [ ] **Step 2: Install**

```bash
corepack pnpm install
```

Expected: installs without errors.

- [ ] **Step 3: Create query-client.ts**

Create `apps/monitoring/src/shared/api/query-client.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

- [ ] **Step 4: Update AppProviders.tsx**

Replace `apps/monitoring/src/app/AppProviders.tsx` with:
```tsx
import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { DocumentThemeSync } from '@vnext-forge-studio/designer-ui';

import { queryClient } from '@monitoring/shared/api/query-client';
import { SonnerProvider } from './notifications/SonnerProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SonnerProvider>
        <DocumentThemeSync />
        {children}
      </SonnerProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/monitoring/package.json apps/monitoring/src/shared/api/query-client.ts apps/monitoring/src/app/AppProviders.tsx
git commit -m "feat(monitoring): add TanStack Query v5 + QueryClientProvider"
```

---

### Task 2: Shared Domain Types

**Files:**
- Create: `apps/monitoring/src/shared/types/domain.ts`
- Create: `apps/monitoring/src/shared/types/instance.ts`
- Create: `apps/monitoring/src/shared/types/workflow.ts`
- Create: `apps/monitoring/src/shared/types/execution.ts`
- Create: `apps/monitoring/src/shared/types/job.ts`
- Create: `apps/monitoring/src/shared/types/definition.ts`
- Create: `apps/monitoring/src/shared/types/index.ts`

- [ ] **Step 1: Create domain.ts**

Create `apps/monitoring/src/shared/types/domain.ts`:
```ts
export interface Domain {
  name: string;
  displayName: string;
  env: string;
  engineVersion: string;
}

export interface InstanceStats {
  total: number;
  active: number;
  busy: number;
  completed: number;
  faulted: number;
  suspended: number;
  terminated: number;
}

export interface ComponentCounts {
  workflows: number;
  tasks: number;
  functions: number;
  views: number;
  extensions: number;
}

export interface StatsTimePoint {
  label: string;
  active: number;
  completed: number;
  faulted: number;
}
```

- [ ] **Step 2: Create instance.ts**

Create `apps/monitoring/src/shared/types/instance.ts`:
```ts
export type InstanceStatus =
  | 'Active'
  | 'Busy'
  | 'Completed'
  | 'Faulted'
  | 'Suspended'
  | 'Terminated';

export interface Instance {
  id: string;
  key: string;
  workflow: string;
  workflowName: string;
  workflowVersion: string;
  domain: string;
  status: InstanceStatus;
  state: string;
  createdAt: string;
  updatedAt: string;
  etag: string;
  tags: string[];
  err?: string;
}

export type TriggerType = 'Automatic' | 'Manual' | 'Event' | 'Scheduled';

export interface Transition {
  name: string;
  from: string;
  to: string;
  trigger: TriggerType;
  at: string;
  by: string;
  note?: string;
  tasks: string[];
}

export interface TaskLogEntry {
  id: string;
  execId?: string;
  taskName: string;
  taskType: 'Http' | 'Script';
  code: number;
  ms: number;
  transition: string;
  at: string;
  ok: boolean;
  error?: string;
  output?: object;
}

export interface DiffEntry {
  op: '+' | '-' | '~';
  path: string;
  value: unknown;
  oldValue?: unknown;
}

export interface DataVersion {
  ver: number;
  at: string;
  transition: string;
  diff: DiffEntry[];
  data: object;
}

export interface Correlation {
  key: string;
  instanceId: string;
  corrType: 'SubFlow' | 'SubProcess';
  workflow: string;
  status: InstanceStatus;
  startedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'initial' | 'state' | 'subflow' | 'finish';
  status?: 'completed' | 'current' | 'pending';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  triggerType: TriggerType;
}

export interface CurrentPermissions {
  state: string;
  transitions: { name: string; roles: string[] }[];
  functions: { name: string; roles: string[] }[];
}

export interface InstanceDetail extends Instance {
  currentPermissions: CurrentPermissions;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  transitions: Transition[];
  taskLog: TaskLogEntry[];
  dataVersions: DataVersion[];
  correlations: Correlation[];
}
```

- [ ] **Step 3: Create workflow.ts**

Create `apps/monitoring/src/shared/types/workflow.ts`:
```ts
import type { InstanceStatus } from './instance';

export type WorkflowType = 'F' | 'S' | 'P';

export interface RelatedComponent {
  compType: 'SubFlow' | 'Task' | 'Function' | 'Extension' | 'View' | 'Schema' | 'Mapping';
  id: string;
  name: string;
}

export interface StatePermission {
  state: string;
  stateType: 'State' | 'SubFlow';
  transitions: { name: string; roles: string[] }[];
  functions: { name: string; roles: string[] }[];
}

export interface WorkflowStats {
  active: number;
  busy: number;
  faulted: number;
  suspended: number;
  completed: number;
  stateDistribution: { state: string; count: number }[];
  duration: { avg: string; min: string; max: string; p95: string };
}

export interface WorkflowDefinition {
  [key: string]: unknown;
}

export interface Workflow {
  id: string;
  name: string;
  type: WorkflowType;
  domain: string;
  version: string;
  versions: string[];
  description: string;
  author: string;
  updatedAt: string;
  tags: string[];
  warn?: string;
  stats: WorkflowStats;
  relatedComponents: RelatedComponent[];
  permissions: StatePermission[];
  definition: WorkflowDefinition;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  type: WorkflowType;
  version: string;
  description: string;
}

export interface WorkflowInstancesResult {
  items: import('./instance').Instance[];
  total: number;
  page: number;
  pageSize: number;
}

export type InstanceSortDirection = 'desc' | 'asc';
export type InstanceTimeFilter = '1h' | '6h' | '24h' | '7d' | 'all';

export interface WorkflowInstancesQuery {
  status?: InstanceStatus | 'all';
  state?: string;
  search?: string;
  sort?: InstanceSortDirection;
  page?: number;
  pageSize?: number;
  timeFilter?: InstanceTimeFilter;
}
```

- [ ] **Step 4: Create execution.ts**

Create `apps/monitoring/src/shared/types/execution.ts`:
```ts
export type TaskExecutionStatus = 'Success' | 'Failed' | 'Running';

export interface TaskError {
  message: string;
  exceptionType: string;
  stackTrace: string;
}

export interface TaskAction {
  id: string;
  status: 'Processing' | 'Completed' | 'Failed';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  detail: object;
}

export interface TaskExecution {
  id: string;
  taskName: string;
  taskType: 'Http' | 'Script';
  instanceId: string;
  instanceKey: string;
  workflow: string;
  triggerType: 'State' | 'Transition';
  triggerLocation: string;
  status: TaskExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs: number;
  input?: object;
  output?: object;
  request?: { method: string; url: string; body: object };
  response?: { statusCode: number; body: object };
  actions: TaskAction[];
  error?: TaskError;
}

export interface TaskExecutionListItem {
  id: string;
  taskName: string;
  taskType: 'Http' | 'Script';
  instanceId: string;
  instanceKey: string;
  workflow: string;
  durationMs: number;
  status: TaskExecutionStatus;
  startedAt: string;
  error?: string;
}

export type FunctionExecutionStatus = 'Success' | 'Failed' | 'Running';

export interface FunctionExecution {
  id: string;
  functionName: string;
  returnType: string;
  instanceId: string;
  instanceKey: string;
  workflow: string;
  durationMs: number;
  status: FunctionExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: { message: string; exceptionType: string };
}
```

- [ ] **Step 5: Create job.ts**

Create `apps/monitoring/src/shared/types/job.ts`:
```ts
export type JobStatus = 'Active' | 'Processed' | 'Failed' | 'Cancelled';
export type ScheduleType = 'delay' | 'cron';

export interface InstanceJob {
  jobName: string;
  jobId: string;
  instanceId: string;
  instanceKey: string;
  workflow: string;
  transition: string;
  scheduleType: ScheduleType;
  schedule: string;
  scheduledFor: string;
  isActive: boolean;
  status: JobStatus;
  retryCount: number;
  lastError?: string;
  traceparent: string;
  createdAt: string;
  firedAt?: string;
}
```

- [ ] **Step 6: Create definition.ts**

Create `apps/monitoring/src/shared/types/definition.ts`:
```ts
export type DefinitionType =
  | 'workflow'
  | 'task'
  | 'function'
  | 'view'
  | 'extension'
  | 'schema'
  | 'mapping';

export interface TaskDefinition {
  id: string;
  name: string;
  taskType: 'Http' | 'Script';
  version: string;
  deprecated?: boolean;
  description: string;
}

export interface FunctionDefinition {
  id: string;
  name: string;
  returnType: string;
  version: string;
  parameters: { name: string; type: string; required: boolean }[];
}

export interface ViewDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface ExtensionDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface SchemaDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface MappingDefinition {
  id: string;
  name: string;
  version: string;
  usedBy: string[];
}
```

- [ ] **Step 7: Create types/index.ts**

Create `apps/monitoring/src/shared/types/index.ts`:
```ts
export * from './domain';
export * from './instance';
export * from './workflow';
export * from './execution';
export * from './job';
export * from './definition';
```

- [ ] **Step 8: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add apps/monitoring/src/shared/types/
git commit -m "feat(monitoring): add shared domain types"
```

---

### Task 3: Config + vite-env Updates

**Files:**
- Modify: `apps/monitoring/src/vite-env.d.ts`
- Modify: `apps/monitoring/src/shared/config/config.ts`

- [ ] **Step 1: Update vite-env.d.ts**

Replace `apps/monitoring/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MONITORING_API_BASE_URL?: string;
  readonly VITE_MONITORING_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Update config.ts**

Replace `apps/monitoring/src/shared/config/config.ts`:
```ts
const rawApiBaseUrl = import.meta.env.VITE_MONITORING_API_BASE_URL;
const rawDomain = import.meta.env.VITE_MONITORING_DOMAIN;

if (!rawApiBaseUrl) {
  console.warn(
    '[monitoring] VITE_MONITORING_API_BASE_URL is not set — defaulting to http://localhost:4203',
  );
}

if (!rawDomain) {
  console.warn('[monitoring] VITE_MONITORING_DOMAIN is not set — defaulting to banking');
}

export const config = {
  apiBaseUrl: rawApiBaseUrl ?? 'http://localhost:4203',
  domain: rawDomain ?? 'banking',
} as const;
```

- [ ] **Step 3: Create monitoring-api.ts**

Create `apps/monitoring/src/shared/api/monitoring-api.ts`:
```ts
import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import { config } from '../config/config';
import { createMonitoringHttpClient } from './api-client';

const client = createMonitoringHttpClient();

/** Throws on ApiFailure, returns data on success. */
export function unwrap<T>(res: ApiResponse<T>): T {
  if (!res.success) throw new Error(res.error.message);
  return res.data;
}

/** Domain-prefixed GET. Path should NOT start with the domain segment. */
export async function domainGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const res = await client.get<T>(`/api/v1/${config.domain}${path}`, params);
  return unwrap(res);
}

/** Domain-prefixed POST. */
export async function domainPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await client.post<T>(`/api/v1/${config.domain}${path}`, body);
  return unwrap(res);
}
```

- [ ] **Step 4: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/monitoring/src/vite-env.d.ts apps/monitoring/src/shared/config/config.ts apps/monitoring/src/shared/api/monitoring-api.ts
git commit -m "feat(monitoring): add domain config + domain-aware API helpers"
```

---

### Task 4: StatusBadge Shared Component

**Files:**
- Create: `apps/monitoring/src/shared/components/StatusBadge.tsx`

- [ ] **Step 1: Create StatusBadge.tsx**

Create `apps/monitoring/src/shared/components/StatusBadge.tsx`:
```tsx
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import type { InstanceStatus } from '@monitoring/shared/types';

type TaskExecStatus = 'Success' | 'Failed' | 'Running';
type JobStatus = 'Active' | 'Processed' | 'Failed' | 'Cancelled';

type StatusValue = InstanceStatus | TaskExecStatus | JobStatus;

interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

const STATUS_CONFIG: Record<StatusValue, {
  variant: 'info' | 'warning' | 'success' | 'destructive' | 'muted' | 'outline';
  label: string;
  className?: string;
}> = {
  // Instance statuses
  Active:     { variant: 'info',        label: 'Active' },
  Busy:       { variant: 'warning',     label: 'Busy' },
  Completed:  { variant: 'success',     label: 'Completed' },
  Faulted:    { variant: 'destructive', label: 'Faulted' },
  Suspended:  {
    variant: 'outline',
    label: 'Suspended',
    className: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400',
  },
  Terminated: { variant: 'muted', label: 'Terminated' },
  // Task execution statuses
  Success:    { variant: 'success',     label: 'Success' },
  Failed:     { variant: 'destructive', label: 'Failed' },
  Running:    { variant: 'info',        label: 'Running' },
  // Job statuses
  Processed:  { variant: 'success',     label: 'Processed' },
  Cancelled:  { variant: 'muted',       label: 'Cancelled' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const conf = STATUS_CONFIG[status];
  if (!conf) return <Badge variant="outline">{status}</Badge>;
  return (
    <Badge
      variant={conf.variant}
      className={cn('font-mono', conf.className, className)}
    >
      {conf.label}
    </Badge>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/monitoring/src/shared/components/StatusBadge.tsx
git commit -m "feat(monitoring): add StatusBadge shared component"
```

---

### Task 5: Favorites Hook + Breadcrumb Utils

**Files:**
- Create: `apps/monitoring/src/app/favorites/useFavorites.ts`
- Create: `apps/monitoring/src/app/layout/breadcrumb-utils.ts`

- [ ] **Step 1: Create useFavorites.ts**

Create `apps/monitoring/src/app/favorites/useFavorites.ts`:
```ts
import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Favorite {
  path: string;
  label: string;
}

interface FavoritesState {
  favorites: Favorite[];
  addFavorite: (fav: Favorite) => void;
  removeFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
  toggleFavorite: (fav: Favorite) => void;
}

const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (fav) =>
        set((s) => {
          if (s.favorites.some((f) => f.path === fav.path)) return s;
          return { favorites: [...s.favorites, fav] };
        }),
      removeFavorite: (path) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.path !== path) })),
      isFavorite: (path) => get().favorites.some((f) => f.path === path),
      toggleFavorite: (fav) => {
        const store = get();
        if (store.isFavorite(fav.path)) {
          store.removeFavorite(fav.path);
        } else {
          store.addFavorite(fav);
        }
      },
    }),
    { name: 'monitoring-favorites' },
  ),
);

export function useFavorites() {
  const { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite } =
    useFavoritesStore();
  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite };
}
```

- [ ] **Step 2: Create breadcrumb-utils.ts**

Create `apps/monitoring/src/app/layout/breadcrumb-utils.ts`:
```ts
export interface Crumb {
  label: string;
  path?: string;
}

/** Build breadcrumb trail from current pathname + route params.
 *  Paths that end with a trailing * (catch-all) are ignored.
 *  Domain label is always first ("Banking" from config.domain).
 */
export function buildBreadcrumbs(
  pathname: string,
  params: Record<string, string | undefined>,
  domainDisplayName: string,
): Crumb[] {
  const domain: Crumb = { label: domainDisplayName };

  // /  (dashboard)
  if (pathname === '/') {
    return [domain, { label: 'Dashboard' }];
  }

  // /faults
  if (pathname === '/faults') {
    return [domain, { label: 'Faults' }];
  }

  // /jobs
  if (pathname === '/jobs') {
    return [domain, { label: 'Jobs' }];
  }

  // /config
  if (pathname === '/config') {
    return [domain, { label: 'Config' }];
  }

  // /task-executions
  if (pathname === '/task-executions') {
    return [domain, { label: 'Task Executions' }];
  }

  // /task-executions/:execId
  if (pathname.startsWith('/task-executions/') && params.execId) {
    return [
      domain,
      { label: 'Task Executions', path: '/task-executions' },
      { label: params.execId },
    ];
  }

  // /function-executions
  if (pathname === '/function-executions') {
    return [domain, { label: 'Function Executions' }];
  }

  // /function-executions/:execId
  if (pathname.startsWith('/function-executions/') && params.execId) {
    return [
      domain,
      { label: 'Function Executions', path: '/function-executions' },
      { label: params.execId },
    ];
  }

  // /definitions/:type
  if (pathname.match(/^\/definitions\/[^/]+$/) && params.type) {
    const label = DEFINITION_TYPE_LABELS[params.type] ?? params.type;
    return [
      domain,
      { label: 'Definitions', path: '/definitions/workflow' },
      { label },
    ];
  }

  // /definitions/:type/:id
  if (pathname.match(/^\/definitions\/[^/]+\/[^/]+$/) && params.type && params.id) {
    const typeLabel = DEFINITION_TYPE_LABELS[params.type] ?? params.type;
    return [
      domain,
      { label: 'Definitions', path: '/definitions/workflow' },
      { label: typeLabel, path: `/definitions/${params.type}` },
      { label: params.id },
    ];
  }

  // /definitions/workflows/:wfId/instances
  if (pathname.includes('/instances') && params.wfId) {
    return [
      domain,
      { label: 'Definitions', path: '/definitions/workflow' },
      { label: 'Workflows', path: '/definitions/workflow' },
      { label: params.wfId, path: `/definitions/workflow/${params.wfId}` },
      { label: 'Instances' },
    ];
  }

  // /instances/:instanceId
  if (pathname.startsWith('/instances/') && params.instanceId) {
    return [domain, { label: 'Instances', path: undefined }, { label: params.instanceId }];
  }

  return [domain, { label: pathname }];
}

export const DEFINITION_TYPE_LABELS: Record<string, string> = {
  workflow: 'Workflows',
  task: 'Tasks',
  function: 'Functions',
  view: 'Views',
  extension: 'Extensions',
  schema: 'Schemas',
  mapping: 'Mappings',
};
```

- [ ] **Step 3: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/monitoring/src/app/favorites/useFavorites.ts apps/monitoring/src/app/layout/breadcrumb-utils.ts
git commit -m "feat(monitoring): add favorites store + breadcrumb utils"
```

---

### Task 6: App Shell Layout (AppShell + Sidebar + Topbar)

**Files:**
- Create: `apps/monitoring/src/app/layout/AppShell.tsx`
- Create: `apps/monitoring/src/app/layout/Sidebar.tsx`
- Create: `apps/monitoring/src/app/layout/Topbar.tsx`

- [ ] **Step 1: Create AppShell.tsx**

Create `apps/monitoring/src/app/layout/AppShell.tsx`:
```tsx
import { type ReactNode } from 'react';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="ml-56 flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Sidebar.tsx**

Create `apps/monitoring/src/app/layout/Sidebar.tsx`:
```tsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowLeftRight,
  CheckSquare,
  ChevronDown,
  Clock,
  Eye,
  FileCode,
  LayoutDashboard,
  Puzzle,
  Settings,
  Star,
  Workflow,
  X,
  Zap,
} from 'lucide-react';

import { cn } from '@monitoring/shared/lib/utils';
import { config } from '@monitoring/shared/config/config';
import { useFavorites } from '@monitoring/app/favorites/useFavorites';

const DEFINITION_TYPES = [
  { label: 'Workflows', key: 'workflow', icon: Workflow },
  { label: 'Tasks', key: 'task', icon: CheckSquare },
  { label: 'Functions', key: 'function', icon: Zap },
  { label: 'Views', key: 'view', icon: Eye },
  { label: 'Extensions', key: 'extension', icon: Puzzle },
  { label: 'Schemas', key: 'schema', icon: FileCode },
  { label: 'Mappings', key: 'mapping', icon: ArrowLeftRight },
] as const;

export function Sidebar() {
  const [definitionsOpen, setDefinitionsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const { favorites, removeFavorite } = useFavorites();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-56 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-800 px-4 py-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
          vN
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-100">vNext</div>
          <div className="font-mono text-[11px] text-slate-500">Monitoring</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        {/* Monitor */}
        <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Monitor
        </p>
        <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" exact />
        <SidebarLink to="/task-executions" icon={Activity} label="Task Executions" />
        <SidebarLink to="/function-executions" icon={Zap} label="Fn Executions" />
        <SidebarLink to="/faults" icon={AlertCircle} label="Faults" />
        <SidebarLink to="/jobs" icon={Clock} label="Jobs" />

        {/* Definitions */}
        <button
          onClick={() => setDefinitionsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400"
        >
          Definitions
          <ChevronDown
            className={cn('h-3 w-3 transition-transform duration-150', definitionsOpen && 'rotate-180')}
          />
        </button>
        {definitionsOpen &&
          DEFINITION_TYPES.map(({ label, key, icon }) => (
            <SidebarLink
              key={key}
              to={`/definitions/${key}`}
              icon={icon}
              label={label}
              indent
            />
          ))}

        {/* Favorites */}
        {favorites.length > 0 && (
          <>
            <button
              onClick={() => setFavoritesOpen((o) => !o)}
              className="flex w-full items-center justify-between px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400"
            >
              Favorites
              <ChevronDown
                className={cn('h-3 w-3 transition-transform duration-150', favoritesOpen && 'rotate-180')}
              />
            </button>
            {favoritesOpen &&
              favorites.map((fav) => (
                <div key={fav.path} className="group flex items-center">
                  <NavLink
                    to={fav.path}
                    className={({ isActive }) =>
                      cn(
                        'flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-slate-700/60 text-slate-100 font-medium'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                      )
                    }
                  >
                    <Star className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{fav.label}</span>
                  </NavLink>
                  <button
                    onClick={() => removeFavorite(fav.path)}
                    className="mr-1 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-300 group-hover:flex"
                    aria-label={`Remove ${fav.label} from favorites`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
          </>
        )}
      </div>

      {/* Config + Footer */}
      <div className="border-t border-slate-800">
        <SidebarLink to="/config" icon={Settings} label="Config" />
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-500" />
          <span className="truncate font-mono text-[11px] text-slate-500">
            {config.domain} · production
          </span>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  icon: Icon,
  label,
  indent = false,
  exact = false,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  indent?: boolean;
  exact?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-sm py-1.5 text-sm transition-colors',
          indent ? 'pl-6 pr-2' : 'px-2',
          isActive
            ? 'bg-slate-700/60 text-slate-100 font-medium'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
```

- [ ] **Step 3: Create Topbar.tsx**

Create `apps/monitoring/src/app/layout/Topbar.tsx`:
```tsx
import { useLocation, useParams, Link } from 'react-router-dom';
import { RefreshCw, Star } from 'lucide-react';

import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { config } from '@monitoring/shared/config/config';
import { useFavorites } from '@monitoring/app/favorites/useFavorites';
import { buildBreadcrumbs } from './breadcrumb-utils';

export function Topbar() {
  const location = useLocation();
  const params = useParams<Record<string, string>>();
  const { isFavorite, toggleFavorite } = useFavorites();

  const displayName = config.domain.charAt(0).toUpperCase() + config.domain.slice(1);
  const crumbs = buildBreadcrumbs(location.pathname, params, displayName);
  const isDashboard = location.pathname === '/';
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? '';
  const currentFav = isFavorite(location.pathname);

  function handleFavToggle() {
    toggleFavorite({ path: location.pathname, label: currentLabel });
  }

  return (
    <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {crumb.path && !isLast ? (
                <Link
                  to={crumb.path}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn(isLast ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!isDashboard && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFavToggle}
            aria-label={currentFav ? 'Remove from favorites' : 'Add to favorites'}
            className="h-8 w-8"
          >
            <Star
              className={cn('h-4 w-4', currentFav && 'fill-current text-amber-500')}
            />
          </Button>
        )}
        <div className="flex h-2 w-2 items-center justify-center">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.reload()}
          aria-label="Refresh"
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          U
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/monitoring/src/app/layout/
git commit -m "feat(monitoring): add AppShell, Sidebar, Topbar layout components"
```

---

### Task 7: Routing Scaffold — AppRouter + All Placeholder Pages

**Files:**
- Modify: `apps/monitoring/src/app/AppRouter.tsx`
- Modify: `apps/monitoring/src/pages/DashboardPage.tsx` (temporary stub — replaced in Task 10)
- Create: `apps/monitoring/src/pages/DefinitionsPage.tsx`
- Create: `apps/monitoring/src/pages/ComponentDetailPage.tsx`
- Create: `apps/monitoring/src/pages/InstanceListPage.tsx`
- Create: `apps/monitoring/src/pages/InstanceDetailPage.tsx`
- Create: `apps/monitoring/src/pages/TaskExecutionsPage.tsx`
- Create: `apps/monitoring/src/pages/TaskExecutionDetailPage.tsx`
- Create: `apps/monitoring/src/pages/FunctionExecutionsPage.tsx`
- Create: `apps/monitoring/src/pages/FunctionExecutionDetailPage.tsx`
- Create: `apps/monitoring/src/pages/JobsPage.tsx`
- Create: `apps/monitoring/src/pages/FaultsPage.tsx`
- Create: `apps/monitoring/src/pages/ConfigPage.tsx`

- [ ] **Step 1: Create placeholder page template**

Each placeholder page uses this shape. Create all of the following files:

`apps/monitoring/src/pages/DefinitionsPage.tsx`:
```tsx
import { useParams } from 'react-router-dom';

export function DefinitionsPage() {
  const { type } = useParams<{ type: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Definitions — {type} (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/ComponentDetailPage.tsx`:
```tsx
import { useParams } from 'react-router-dom';

export function ComponentDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      {type} Detail — {id} (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/InstanceListPage.tsx`:
```tsx
import { useParams } from 'react-router-dom';

export function InstanceListPage() {
  const { wfId } = useParams<{ wfId: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Instance List — {wfId} (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/InstanceDetailPage.tsx`:
```tsx
import { useParams } from 'react-router-dom';

export function InstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Instance Detail — {instanceId} (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/TaskExecutionsPage.tsx`:
```tsx
export function TaskExecutionsPage() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Task Executions (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/TaskExecutionDetailPage.tsx`:
```tsx
import { useParams } from 'react-router-dom';

export function TaskExecutionDetailPage() {
  const { execId } = useParams<{ execId: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Task Execution Detail — {execId} (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/FunctionExecutionsPage.tsx`:
```tsx
export function FunctionExecutionsPage() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Function Executions (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/FunctionExecutionDetailPage.tsx`:
```tsx
import { useParams } from 'react-router-dom';

export function FunctionExecutionDetailPage() {
  const { execId } = useParams<{ execId: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Function Execution Detail — {execId} (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/JobsPage.tsx`:
```tsx
export function JobsPage() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Jobs (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/FaultsPage.tsx`:
```tsx
export function FaultsPage() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Faults (coming soon)
    </div>
  );
}
```

`apps/monitoring/src/pages/ConfigPage.tsx`:
```tsx
export function ConfigPage() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Config (coming soon)
    </div>
  );
}
```

- [ ] **Step 2: Replace AppRouter.tsx**

Replace `apps/monitoring/src/app/AppRouter.tsx` with:
```tsx
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';

import { AppShell } from './layout/AppShell';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { DashboardPage } from '@monitoring/pages/DashboardPage';
import { DefinitionsPage } from '@monitoring/pages/DefinitionsPage';
import { ComponentDetailPage } from '@monitoring/pages/ComponentDetailPage';
import { InstanceListPage } from '@monitoring/pages/InstanceListPage';
import { InstanceDetailPage } from '@monitoring/pages/InstanceDetailPage';
import { TaskExecutionsPage } from '@monitoring/pages/TaskExecutionsPage';
import { TaskExecutionDetailPage } from '@monitoring/pages/TaskExecutionDetailPage';
import { FunctionExecutionsPage } from '@monitoring/pages/FunctionExecutionsPage';
import { FunctionExecutionDetailPage } from '@monitoring/pages/FunctionExecutionDetailPage';
import { JobsPage } from '@monitoring/pages/JobsPage';
import { FaultsPage } from '@monitoring/pages/FaultsPage';
import { ConfigPage } from '@monitoring/pages/ConfigPage';
import { NotFoundPage } from '@monitoring/pages/NotFoundPage';

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="definitions/:type" element={<DefinitionsPage />} />
            <Route
              path="definitions/workflows/:wfId/instances"
              element={<InstanceListPage />}
            />
            <Route path="definitions/:type/:id" element={<ComponentDetailPage />} />
            <Route path="instances/:instanceId" element={<InstanceDetailPage />} />
            <Route path="task-executions" element={<TaskExecutionsPage />} />
            <Route path="task-executions/:execId" element={<TaskExecutionDetailPage />} />
            <Route path="function-executions" element={<FunctionExecutionsPage />} />
            <Route
              path="function-executions/:execId"
              element={<FunctionExecutionDetailPage />}
            />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="faults" element={<FaultsPage />} />
            <Route path="config" element={<ConfigPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
```

**Note on route order:** `definitions/workflows/:wfId/instances` is declared BEFORE `definitions/:type/:id` so React Router matches it first. This is intentional.

- [ ] **Step 3: Add temporary DashboardPage stub**

Replace `apps/monitoring/src/pages/DashboardPage.tsx` with:
```tsx
export function DashboardPage() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Dashboard (wiring up in next tasks...)
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/monitoring/src/app/AppRouter.tsx apps/monitoring/src/pages/
git commit -m "feat(monitoring): add full routing scaffold + placeholder pages"
```

---

### Task 8: Dashboard — API Query Hooks

**Files:**
- Create: `apps/monitoring/src/modules/dashboard/api/dashboard-queries.ts`

- [ ] **Step 1: Create dashboard-queries.ts**

Create `apps/monitoring/src/modules/dashboard/api/dashboard-queries.ts`:
```ts
import { useQuery } from '@tanstack/react-query';

import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { ComponentCounts, Instance, InstanceStats, StatsTimePoint } from '@monitoring/shared/types';

export type StatsTimeRange = '24h' | '7d' | '30d';

export function useInstanceStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => domainGet<InstanceStats>('/stats'),
  });
}

export function useStatsTimeSeries(range: StatsTimeRange) {
  return useQuery({
    queryKey: ['dashboard', 'stats', 'timeseries', range],
    queryFn: () => domainGet<StatsTimePoint[]>(`/stats/hourly`, { range }),
  });
}

export function useRecentFaults() {
  return useQuery({
    queryKey: ['dashboard', 'recent-faults'],
    queryFn: () =>
      domainGet<Instance[]>('/instances', {
        status: 'Faulted',
        limit: '5',
        sort: 'desc',
      }),
  });
}

export function useComponentCounts() {
  return useQuery({
    queryKey: ['dashboard', 'component-counts'],
    queryFn: () => domainGet<ComponentCounts>('/components/counts'),
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/monitoring/src/modules/dashboard/api/dashboard-queries.ts
git commit -m "feat(monitoring): add dashboard TanStack Query hooks"
```

---

### Task 9: Dashboard — UI Components

**Files:**
- Create: `apps/monitoring/src/modules/dashboard/components/KpiCard.tsx`
- Create: `apps/monitoring/src/modules/dashboard/components/ComponentCountsSection.tsx`
- Create: `apps/monitoring/src/modules/dashboard/components/InstanceDistSection.tsx`
- Create: `apps/monitoring/src/modules/dashboard/components/ActivityChart.tsx`
- Create: `apps/monitoring/src/modules/dashboard/components/RecentFaultsSection.tsx`

- [ ] **Step 1: Create KpiCard.tsx**

Create `apps/monitoring/src/modules/dashboard/components/KpiCard.tsx`:
```tsx
import { type ReactNode } from 'react';
import { cn } from '@monitoring/shared/lib/utils';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'warning';
  className?: string;
}

export function KpiCard({ label, value, icon, onClick, variant = 'default', className }: KpiCardProps) {
  const isClickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm',
        isClickable && 'cursor-pointer transition-shadow hover:shadow-md',
        variant === 'danger' && isClickable && 'hover:border-destructive/40',
        variant === 'warning' && isClickable && 'hover:border-warning/40',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create ComponentCountsSection.tsx**

Create `apps/monitoring/src/modules/dashboard/components/ComponentCountsSection.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Eye, Puzzle, Workflow, Zap } from 'lucide-react';

import type { ComponentCounts } from '@monitoring/shared/types';
import { KpiCard } from './KpiCard';

interface ComponentCountsSectionProps {
  data: ComponentCounts | undefined;
  isLoading: boolean;
}

const COMPONENT_CARDS = [
  { key: 'workflows' as const, label: 'Workflows', icon: Workflow, type: 'workflow' },
  { key: 'tasks' as const, label: 'Tasks', icon: CheckSquare, type: 'task' },
  { key: 'functions' as const, label: 'Functions', icon: Zap, type: 'function' },
  { key: 'views' as const, label: 'Views', icon: Eye, type: 'view' },
  { key: 'extensions' as const, label: 'Extensions', icon: Puzzle, type: 'extension' },
];

export function ComponentCountsSection({ data, isLoading }: ComponentCountsSectionProps) {
  const navigate = useNavigate();

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Registered Components
      </h2>
      <div className="grid grid-cols-5 gap-3">
        {COMPONENT_CARDS.map(({ key, label, icon: Icon, type }) => (
          <KpiCard
            key={key}
            label={label}
            value={isLoading ? '—' : (data?.[key] ?? 0)}
            icon={<Icon className="h-4 w-4" />}
            onClick={() => navigate(`/definitions/${type}`)}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create InstanceDistSection.tsx**

Create `apps/monitoring/src/modules/dashboard/components/InstanceDistSection.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';

import type { InstanceStats } from '@monitoring/shared/types';
import { KpiCard } from './KpiCard';

interface InstanceDistSectionProps {
  data: InstanceStats | undefined;
  isLoading: boolean;
}

export function InstanceDistSection({ data, isLoading }: InstanceDistSectionProps) {
  const navigate = useNavigate();
  const v = (n: number | undefined) => (isLoading ? '—' : (n ?? 0));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Instance Distribution
        </h2>
        <span className="text-xs text-muted-foreground">last 7 days</span>
      </div>
      <div className="grid grid-cols-7 gap-3">
        <KpiCard label="Total" value={v(data?.total)} />
        <KpiCard label="Active" value={v(data?.active)} />
        <KpiCard label="Busy" value={v(data?.busy)} variant="warning" />
        <KpiCard label="Completed" value={v(data?.completed)} />
        <KpiCard
          label="Faulted"
          value={v(data?.faulted)}
          variant="danger"
          onClick={() => navigate('/faults')}
        />
        <KpiCard label="Suspended" value={v(data?.suspended)} />
        <KpiCard label="Terminated" value={v(data?.terminated)} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create ActivityChart.tsx**

Create `apps/monitoring/src/modules/dashboard/components/ActivityChart.tsx`:
```tsx
import { useState } from 'react';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import type { StatsTimePoint } from '@monitoring/shared/types';
import type { StatsTimeRange } from '../api/dashboard-queries';

interface ActivityChartProps {
  data: StatsTimePoint[] | undefined;
  isLoading: boolean;
  range: StatsTimeRange;
  onRangeChange: (r: StatsTimeRange) => void;
}

const CHART_H = 120;
const CHART_W = 600;
const PAD = { top: 10, right: 10, bottom: 24, left: 32 };

function toSvgPoints(values: number[], max: number, width: number, height: number): string {
  if (!values.length) return '';
  const step = width / (values.length - 1 || 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - (max > 0 ? (v / max) * height : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function toAreaPath(values: number[], max: number, width: number, height: number): string {
  if (!values.length) return '';
  const step = width / (values.length - 1 || 1);
  const pts = values
    .map((v, i) => {
      const x = i * step;
      const y = height - (max > 0 ? (v / max) * height : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' L ');
  return `M 0,${height} L ${pts} L ${width},${height} Z`;
}

export function ActivityChart({ data, isLoading, range, onRangeChange }: ActivityChartProps) {
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const activeVals = data?.map((p) => p.active) ?? [];
  const completedVals = data?.map((p) => p.completed) ?? [];
  const faultedVals = data?.map((p) => p.faulted) ?? [];
  const labels = data?.map((p) => p.label) ?? [];

  const maxVal = Math.max(...activeVals, ...completedVals, ...faultedVals, 1);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Instance Activity
        </h2>
        <div className="flex gap-1">
          {(['24h', '7d'] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onRangeChange(r)}
              className="h-7 px-2.5 text-xs"
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        {/* Legend */}
        <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 opacity-70" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Faulted
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            Loading chart data…
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full"
            style={{ height: CHART_H }}
          >
            <defs>
              <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <g transform={`translate(${PAD.left},${PAD.top})`}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1="0"
                  y1={(innerH * (1 - f)).toFixed(1)}
                  x2={innerW}
                  y2={(innerH * (1 - f)).toFixed(1)}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeWidth="1"
                />
              ))}

              {/* Active area */}
              {activeVals.length > 1 && (
                <path
                  d={toAreaPath(activeVals, maxVal, innerW, innerH)}
                  fill="url(#activeGrad)"
                />
              )}

              {/* Active line */}
              {activeVals.length > 1 && (
                <polyline
                  points={toSvgPoints(activeVals, maxVal, innerW, innerH)}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeOpacity="0.8"
                />
              )}

              {/* Completed dashed */}
              {completedVals.length > 1 && (
                <polyline
                  points={toSvgPoints(completedVals, maxVal, innerW, innerH)}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )}

              {/* Faulted dots */}
              {faultedVals.map((v, i) => {
                const step = innerW / (faultedVals.length - 1 || 1);
                const cx = i * step;
                const cy = innerH - (maxVal > 0 ? (v / maxVal) * innerH : 0);
                return (
                  <circle
                    key={i}
                    cx={cx.toFixed(1)}
                    cy={cy.toFixed(1)}
                    r="3"
                    fill="#ef4444"
                    fillOpacity="0.8"
                  />
                );
              })}

              {/* X axis labels */}
              {labels.map((label, i) => {
                const step = innerW / (labels.length - 1 || 1);
                const showEvery = Math.ceil(labels.length / 8);
                if (i % showEvery !== 0 && i !== labels.length - 1) return null;
                return (
                  <text
                    key={i}
                    x={(i * step).toFixed(1)}
                    y={innerH + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                    fillOpacity="0.4"
                  >
                    {label}
                  </text>
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create RecentFaultsSection.tsx**

Create `apps/monitoring/src/modules/dashboard/components/RecentFaultsSection.tsx`:
```tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import type { Instance } from '@monitoring/shared/types';

interface RecentFaultsSectionProps {
  data: Instance[] | undefined;
  isLoading: boolean;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentFaultsSection({ data, isLoading }: RecentFaultsSectionProps) {
  const navigate = useNavigate();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Faults
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/faults')}
          className="h-7 px-2 text-xs"
        >
          View all →
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !data?.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No recent faults
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Instance Key
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Workflow
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  State
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Error
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((instance) => (
                <tr
                  key={instance.id}
                  onClick={() => navigate(`/instances/${instance.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-destructive">
                      {instance.key}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{instance.workflowName}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">{instance.state}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="truncate text-xs text-muted-foreground">
                      {instance.err ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatRelativeTime(instance.updatedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/monitoring/src/modules/dashboard/
git commit -m "feat(monitoring): add dashboard UI components (KPI, chart, faults)"
```

---

### Task 10: Dashboard Page — Wire Everything Together

**Files:**
- Modify: `apps/monitoring/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Replace DashboardPage.tsx with final implementation**

Replace `apps/monitoring/src/pages/DashboardPage.tsx`:
```tsx
import { useState } from 'react';

import { ComponentCountsSection } from '@monitoring/modules/dashboard/components/ComponentCountsSection';
import { InstanceDistSection } from '@monitoring/modules/dashboard/components/InstanceDistSection';
import { ActivityChart } from '@monitoring/modules/dashboard/components/ActivityChart';
import { RecentFaultsSection } from '@monitoring/modules/dashboard/components/RecentFaultsSection';
import {
  useComponentCounts,
  useInstanceStats,
  useRecentFaults,
  useStatsTimeSeries,
  type StatsTimeRange,
} from '@monitoring/modules/dashboard/api/dashboard-queries';

export function DashboardPage() {
  const [range, setRange] = useState<StatsTimeRange>('24h');

  const stats = useInstanceStats();
  const timeSeries = useStatsTimeSeries(range);
  const recentFaults = useRecentFaults();
  const componentCounts = useComponentCounts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Domain overview and activity summary
        </p>
      </div>

      <ComponentCountsSection
        data={componentCounts.data}
        isLoading={componentCounts.isLoading}
      />

      <InstanceDistSection
        data={stats.data}
        isLoading={stats.isLoading}
      />

      <ActivityChart
        data={timeSeries.data}
        isLoading={timeSeries.isLoading}
        range={range}
        onRangeChange={setRange}
      />

      <RecentFaultsSection
        data={recentFaults.data}
        isLoading={recentFaults.isLoading}
      />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Verify dev server starts**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring dev
```

Expected: Vite starts on http://localhost:3100. Open the URL in a browser and verify:
- Dark sidebar renders with all sections (Monitor, Definitions, Favorites, Config footer)
- Topbar renders with "Banking / Dashboard" breadcrumb
- Dashboard page renders with 4 sections (all in loading state since no API is running)
- Clicking sidebar links navigates between pages
- Clicking "Workflows" in sidebar goes to `/definitions/workflow` (shows placeholder)
- Clicking the star icon on any non-dashboard page saves/removes favorites

- [ ] **Step 4: Commit**

```bash
git add apps/monitoring/src/pages/DashboardPage.tsx
git commit -m "feat(monitoring): wire up DashboardPage with all sections + TanStack Query"
```

---

## Self-Review

### Spec Coverage vs. Handoff

- ✅ App shell layout (sidebar 224px + topbar 52px + scrollable canvas 28px padding)
- ✅ Sidebar sections: Logo, Monitor, Definitions (collapsible), Favorites (collapsible, localStorage), Config (bottom), Footer (green dot + domain · env)
- ✅ Topbar: breadcrumbs, FavStar (except Dashboard), live indicator, refresh, avatar
- ✅ Dashboard — Registered Components KPI (5 cards, tıklanabilir)
- ✅ Dashboard — Instance Distribution KPI (7 cards, Faulted tıklanabilir)
- ✅ Dashboard — Activity Chart (SVG, 24h/7d toggle)
- ✅ Dashboard — Recent Faults (son 5, tıklanabilir → Instance Detail)
- ✅ Routing scaffold for all 12 routes + 404
- ✅ All shared types from handoff data models
- ✅ StatusBadge with all 10 statuses
- ✅ TanStack Query setup + domain-aware API helpers

### Not in Phase 1 (Planned for Later Phases)

- Phase 2: Definitions list + all 7 component detail pages
- Phase 3: Instance List + Instance Detail (7 tabs) + State Graph (Reactflow)
- Phase 4: Task/Function Executions, Jobs, Faults, Config pages
