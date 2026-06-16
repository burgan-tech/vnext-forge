# Monitoring Phase 2 — Definitions & Instances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Definitions and Instances UI for the monitoring app — API hooks, shared components, list pages, and type-specific detail pages (Workflow with 6 tabs, Task/Function/View/Extension with 3 tabs, Schema/Mapping with 4 tabs).

**Architecture:** Vertical-slice structure under `modules/definitions/` and `modules/instances/`. Pages in `pages/` stay thin routers and composition points; all business logic lives inside the owning module. `ComponentDetailPage` dispatches to type-specific detail components by reading the `:type` route param.

**Tech Stack:** React 18, TanStack Query v5, React Router v6, `@vnext-forge-studio/designer-ui/ui` primitives, `lucide-react` icons, Tailwind semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`), TypeScript strict.

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `apps/monitoring/src/shared/types/definitions-api.ts` | CREATE | `DefinitionListItem` union type for the list API |
| `apps/monitoring/src/modules/definitions/api/definitions-queries.ts` | CREATE | TanStack Query hooks for definition list and detail |
| `apps/monitoring/src/modules/instances/api/instances-queries.ts` | CREATE | TanStack Query hooks for instance list |
| `apps/monitoring/src/modules/definitions/components/VersionPicker.tsx` | CREATE | Version selector dropdown |
| `apps/monitoring/src/modules/definitions/components/RawJsonViewer.tsx` | CREATE | Copy-to-clipboard JSON pre block |
| `apps/monitoring/src/modules/definitions/components/RelatedComponentsList.tsx` | CREATE | Grouped list of related components with navigation |
| `apps/monitoring/src/pages/DefinitionsPage.tsx` | REPLACE | Type-aware list table (was placeholder) |
| `apps/monitoring/src/pages/InstanceListPage.tsx` | REPLACE | Filterable/paginated instance list (was placeholder) |
| `apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx` | CREATE | 6-tab workflow detail |
| `apps/monitoring/src/modules/definitions/task/TaskDetailPage.tsx` | CREATE | 3-tab task detail |
| `apps/monitoring/src/modules/definitions/function/FunctionDetailPage.tsx` | CREATE | 3-tab function detail |
| `apps/monitoring/src/modules/definitions/view/ViewDetailPage.tsx` | CREATE | 3-tab view detail |
| `apps/monitoring/src/modules/definitions/extension/ExtensionDetailPage.tsx` | CREATE | 3-tab extension detail |
| `apps/monitoring/src/modules/definitions/schema/SchemaDetailPage.tsx` | CREATE | 4-tab schema detail with Test tab |
| `apps/monitoring/src/modules/definitions/mapping/MappingDetailPage.tsx` | CREATE | 4-tab mapping detail with Script tab |
| `apps/monitoring/src/pages/ComponentDetailPage.tsx` | REPLACE | Type-dispatch router (was placeholder) |

---

## Key Conventions (Phase 1 established)

- UI primitives: `import { Button, Badge, Select, ... } from '@vnext-forge-studio/designer-ui/ui'`
- cn utility: `import { cn } from '@monitoring/shared/lib/utils'`
- API: `domainGet<T>(path, params?)` and `domainPost<T>(path, body?)` from `@monitoring/shared/api/monitoring-api`
- Import alias `@monitoring` → `apps/monitoring/src/`
- No `DesignerUiProvider`, no `ApiTransport`
- All UI text in English
- Semantic tokens for content areas
- `DefinitionType` already exists in `shared/types/definition.ts` — do **not** redefine it in new files, import from there
- `InstanceStatus`, `Instance` types are in `shared/types/instance.ts`
- `Workflow`, `WorkflowListItem`, `WorkflowStats`, `WorkflowDefinition`, `RelatedComponent`, `StatePermission` are in `shared/types/workflow.ts`

---

## Task 1: Shared Types — `DefinitionListItem`

**Files:**
- Create: `apps/monitoring/src/shared/types/definitions-api.ts`
- Modify: `apps/monitoring/src/shared/types/index.ts` (add re-export)

- [ ] **Step 1: Create the type file**

```ts
// apps/monitoring/src/shared/types/definitions-api.ts
export interface DefinitionListItem {
  id: string;
  name: string;
  version: string;
  // type-specific fields (undefined when not applicable)
  type?: string;           // workflow: 'F'|'S'|'P'
  taskType?: string;       // task: 'Http'|'Script'
  deprecated?: boolean;   // task
  returnType?: string;     // function
  parameterCount?: number; // function
  description?: string;   // view, extension, schema
  usedBy?: string[];       // mapping
}
```

- [ ] **Step 2: Re-export from the shared types barrel**

Open `apps/monitoring/src/shared/types/index.ts`. It currently contains:
```ts
export * from './domain';
export * from './instance';
export * from './workflow';
export * from './execution';
export * from './job';
export * from './definition';
```

Add one line at the end:
```ts
export * from './definitions-api';
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/shared/types/definitions-api.ts \
  apps/monitoring/src/shared/types/index.ts
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): add DefinitionListItem shared type"
```

---

## Task 2: API Hooks

**Files:**
- Create: `apps/monitoring/src/modules/definitions/api/definitions-queries.ts`
- Create: `apps/monitoring/src/modules/instances/api/instances-queries.ts`

### definitions-queries.ts

Note: `DefinitionType` is **already defined** in `shared/types/definition.ts` — import it from `@monitoring/shared/types`, do not redefine it.

- [ ] **Step 1: Create the definitions query hooks file**

```ts
// apps/monitoring/src/modules/definitions/api/definitions-queries.ts
import { useQuery } from '@tanstack/react-query';
import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { Workflow } from '@monitoring/shared/types';
import type { DefinitionType } from '@monitoring/shared/types/definition';
import type { DefinitionListItem } from '@monitoring/shared/types/definitions-api';

export function useDefinitionList(type: DefinitionType) {
  return useQuery({
    queryKey: ['definitions', type],
    queryFn: () => domainGet<DefinitionListItem[]>(`/components/${type}s`),
    enabled: Boolean(type),
  });
}

export function useWorkflowDetail(id: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', id],
    queryFn: () => domainGet<Workflow>(`/components/workflows/${id}`),
    enabled: Boolean(id),
  });
}

export function useWorkflowVersions(id: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', id, 'versions'],
    queryFn: () => domainGet<string[]>(`/components/workflows/${id}/versions`),
    enabled: Boolean(id),
  });
}

/** Generic detail for non-workflow types — returns raw JSON. */
export function useComponentDetail(type: DefinitionType, id: string) {
  return useQuery({
    queryKey: ['definitions', type, id],
    queryFn: () => domainGet<Record<string, unknown>>(`/components/${type}s/${id}`),
    enabled: Boolean(type) && Boolean(id),
  });
}
```

### instances-queries.ts

- [ ] **Step 2: Create the instances query hooks file**

```ts
// apps/monitoring/src/modules/instances/api/instances-queries.ts
import { useQuery } from '@tanstack/react-query';
import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { Instance, InstanceStatus } from '@monitoring/shared/types';

export type InstanceTimeFilter = '1h' | '6h' | '24h' | '7d' | 'all';
export type InstanceSortOrder = 'desc' | 'asc';

export interface InstanceListParams {
  workflowId?: string;
  status?: InstanceStatus | 'all';
  state?: string;
  search?: string;
  timeFilter?: InstanceTimeFilter;
  sort?: InstanceSortOrder;
  page?: number;
  pageSize?: number;
}

export interface InstanceListResult {
  items: Instance[];
  total: number;
  page: number;
  pageSize: number;
}

export function useInstanceList(params: InstanceListParams) {
  const query: Record<string, string> = {};
  if (params.workflowId) query.workflow = params.workflowId;
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.state) query.state = params.state;
  if (params.search) query.search = params.search;
  if (params.timeFilter && params.timeFilter !== 'all') query.timeFilter = params.timeFilter;
  if (params.sort) query.sort = params.sort;
  if (params.page) query.page = String(params.page);
  if (params.pageSize) query.pageSize = String(params.pageSize);

  return useQuery({
    queryKey: ['instances', params],
    queryFn: () => domainGet<InstanceListResult>('/instances', query),
  });
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/modules/definitions/api/definitions-queries.ts \
  apps/monitoring/src/modules/instances/api/instances-queries.ts
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): add definitions and instances TanStack Query hooks"
```

---

## Task 3: Shared Definition Components

**Files:**
- Create: `apps/monitoring/src/modules/definitions/components/VersionPicker.tsx`
- Create: `apps/monitoring/src/modules/definitions/components/RawJsonViewer.tsx`
- Create: `apps/monitoring/src/modules/definitions/components/RelatedComponentsList.tsx`

- [ ] **Step 1: Create VersionPicker**

```tsx
// apps/monitoring/src/modules/definitions/components/VersionPicker.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vnext-forge-studio/designer-ui/ui';

interface VersionPickerProps {
  currentVersion: string;
  versions: string[];
  onChange?: (version: string) => void;
  disabled?: boolean;
}

export function VersionPicker({ currentVersion, versions, onChange, disabled }: VersionPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Version</span>
      <Select
        value={currentVersion}
        onValueChange={onChange}
        disabled={disabled || versions.length <= 1}
      >
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v} value={v} className="text-xs font-mono">
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Create RawJsonViewer**

```tsx
// apps/monitoring/src/modules/definitions/components/RawJsonViewer.tsx
import { useState } from 'react';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { Copy, Check } from 'lucide-react';

interface RawJsonViewerProps {
  data: unknown;
}

export function RawJsonViewer({ data }: RawJsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="absolute right-2 top-2 h-7 w-7"
        aria-label="Copy JSON"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <pre className="max-h-[600px] overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed font-mono text-foreground">
        {json}
      </pre>
    </div>
  );
}
```

- [ ] **Step 3: Create RelatedComponentsList**

```tsx
// apps/monitoring/src/modules/definitions/components/RelatedComponentsList.tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CheckSquare, Eye, Puzzle, Workflow, Zap } from 'lucide-react';
import type { RelatedComponent } from '@monitoring/shared/types';

const COMP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SubFlow: Workflow,
  Task: CheckSquare,
  Function: Zap,
  Extension: Puzzle,
  View: Eye,
  Schema: ({ className }: { className?: string }) => (
    <span className={className} aria-hidden>S</span>
  ),
  Mapping: ArrowLeftRight,
};

const COMP_ROUTE: Record<string, string> = {
  SubFlow: 'workflow',
  Task: 'task',
  Function: 'function',
  Extension: 'extension',
  View: 'view',
  Schema: 'schema',
  Mapping: 'mapping',
};

interface RelatedComponentsListProps {
  components: RelatedComponent[];
}

export function RelatedComponentsList({ components }: RelatedComponentsListProps) {
  const navigate = useNavigate();

  if (!components.length) {
    return <p className="text-sm text-muted-foreground">No related components.</p>;
  }

  const grouped = components.reduce<Record<string, RelatedComponent[]>>((acc, c) => {
    (acc[c.compType] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(grouped).map(([compType, items]) => {
        const Icon = COMP_ICONS[compType] ?? Workflow;
        return (
          <div key={compType}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {compType}s
            </h3>
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    navigate(`/definitions/${COMP_ROUTE[compType] ?? 'workflow'}/${item.id}`)
                  }
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-auto">{item.id}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/modules/definitions/components/VersionPicker.tsx \
  apps/monitoring/src/modules/definitions/components/RawJsonViewer.tsx \
  apps/monitoring/src/modules/definitions/components/RelatedComponentsList.tsx
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): add shared definition components (VersionPicker, RawJsonViewer, RelatedComponentsList)"
```

---

## Task 4: Definitions List Page

**Files:**
- Modify: `apps/monitoring/src/pages/DefinitionsPage.tsx` (replace placeholder)

The current file is a placeholder. Replace the entire file.

Note: `DefinitionType` comes from `@monitoring/shared/types/definition`, NOT from `definitions-queries.ts`. The queries file imports and re-uses it from there.

- [ ] **Step 1: Replace DefinitionsPage**

```tsx
// apps/monitoring/src/pages/DefinitionsPage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { useDefinitionList } from '@monitoring/modules/definitions/api/definitions-queries';
import type { DefinitionType } from '@monitoring/shared/types/definition';
import type { DefinitionListItem } from '@monitoring/shared/types/definitions-api';

const WORKFLOW_TYPE_LABELS: Record<string, string> = { F: 'Flow', S: 'State', P: 'Process' };
const WORKFLOW_TYPE_VARIANTS: Record<
  string,
  'info' | 'warning' | 'secondary'
> = { F: 'info', S: 'warning', P: 'secondary' };

function WorkflowRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3">
        <Badge
          variant={WORKFLOW_TYPE_VARIANTS[item.type ?? 'F'] ?? 'secondary'}
          className="font-mono text-xs"
        >
          {WORKFLOW_TYPE_LABELS[item.type ?? ''] ?? item.type ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
    </>
  );
}

function TaskRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3">
        <Badge
          variant={item.taskType === 'Http' ? 'info' : 'secondary'}
          className="font-mono text-xs"
        >
          {item.taskType ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3">
        {item.deprecated && (
          <Badge variant="destructive" className="text-xs">
            Deprecated
          </Badge>
        )}
      </td>
    </>
  );
}

function FunctionRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.returnType ?? '—'}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.parameterCount ?? 0} params</td>
    </>
  );
}

function DefaultRow({ item }: { item: DefinitionListItem }) {
  return (
    <>
      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.version}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description ?? '—'}</td>
      {item.usedBy !== undefined && (
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {item.usedBy.join(', ') || '—'}
        </td>
      )}
    </>
  );
}

const HEADERS: Record<string, string[]> = {
  workflow: ['Name', 'Type', 'Version', 'Description'],
  task: ['Name', 'Task Type', 'Version', 'Status'],
  function: ['Name', 'Return Type', 'Version', 'Parameters'],
  mapping: ['Name', 'Version', 'Description', 'Used By'],
  default: ['Name', 'Version', 'Description'],
};

function getHeaders(type: string): string[] {
  return HEADERS[type] ?? HEADERS.default;
}

export function DefinitionsPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const defType = (type ?? 'workflow') as DefinitionType;
  const { data, isLoading } = useDefinitionList(defType);

  const filtered = (data ?? []).filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
  });

  const headers = getHeaders(defType);

  function renderRow(item: DefinitionListItem) {
    switch (defType) {
      case 'workflow':
        return <WorkflowRow item={item} />;
      case 'task':
        return <TaskRow item={item} />;
      case 'function':
        return <FunctionRow item={item} />;
      default:
        return <DefaultRow item={item} />;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground capitalize">
          {defType}s
        </h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading {defType}s…
          </div>
        ) : !filtered.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {search ? `No ${defType}s match "${search}"` : `No ${defType}s found`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/definitions/${defType}/${item.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                >
                  {renderRow(item)}
                  <td className="px-4 py-3 text-right text-muted-foreground">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} {defType}
          {filtered.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/pages/DefinitionsPage.tsx
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): implement DefinitionsPage with type-aware columns and search"
```

---

## Task 5: Instance List Page

**Files:**
- Modify: `apps/monitoring/src/pages/InstanceListPage.tsx` (replace placeholder)

The route for workflow-scoped instances is `definitions/workflows/:wfId/instances` (from `AppRouter.tsx`), so `useParams` provides `wfId`. The route `/instances/:instanceId` is a separate detail page (already exists).

- [ ] **Step 1: Replace InstanceListPage**

```tsx
// apps/monitoring/src/pages/InstanceListPage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vnext-forge-studio/designer-ui/ui';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import {
  useInstanceList,
  type InstanceListParams,
  type InstanceTimeFilter,
  type InstanceSortOrder,
} from '@monitoring/modules/instances/api/instances-queries';
import type { InstanceStatus } from '@monitoring/shared/types';
import { cn } from '@monitoring/shared/lib/utils';

const STATUS_OPTIONS: Array<{ label: string; value: InstanceStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Busy', value: 'Busy' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Faulted', value: 'Faulted' },
  { label: 'Suspended', value: 'Suspended' },
  { label: 'Terminated', value: 'Terminated' },
];

const TIME_OPTIONS: Array<{ label: string; value: InstanceTimeFilter }> = [
  { label: 'All', value: 'all' },
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatDuration(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function InstanceListPage() {
  const { wfId } = useParams<{ wfId: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<InstanceStatus | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<InstanceTimeFilter>('all');
  const [sort, setSort] = useState<InstanceSortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');

  const params: InstanceListParams = {
    workflowId: wfId,
    status,
    timeFilter,
    sort,
    page,
    pageSize,
    search: search || undefined,
  };

  const { data, isLoading } = useInstanceList(params);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleStatusChange(v: string) {
    setStatus(v as InstanceStatus | 'all');
    setPage(1);
  }

  function handlePageSizeChange(v: string) {
    setPageSize(Number(v));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {wfId ? `${wfId} Instances` : 'All Instances'}
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status chips */}
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                status === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Time filter */}
        <div className="flex gap-1">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setTimeFilter(opt.value); setPage(1); }}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                timeFilter === opt.value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort order */}
        <Select value={sort} onValueChange={(v) => setSort(v as InstanceSortOrder)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc" className="text-xs">Newest first</SelectItem>
            <SelectItem value="asc" className="text-xs">Oldest first</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <input
          type="search"
          placeholder="Search instance key..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-8 w-52 rounded-md border border-border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading instances…
          </div>
        ) : !items.length ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No instances found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Instance Key', 'Version', 'State', 'Status', 'Created At', 'Duration'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((inst) => (
                <tr
                  key={inst.id}
                  onClick={() => navigate(`/instances/${inst.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-primary">{inst.key}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.workflowVersion}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inst.state}</td>
                  <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(inst.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {formatDuration(inst.createdAt, inst.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total > 0
            ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} instances`
            : 'No instances'}
        </span>
        <div className="flex items-center gap-2">
          <span>Rows:</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)} className="text-xs">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = i + Math.max(1, Math.min(page - 2, totalPages - 4));
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'h-7 w-7 rounded text-xs font-medium',
                  p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {p}
              </button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/pages/InstanceListPage.tsx
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): implement InstanceListPage with filters, sort, and pagination"
```

---

## Task 6: Workflow Detail Page (6 tabs)

**Files:**
- Create: `apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx`

The `Workflow` type (from `shared/types/workflow.ts`) has: `id`, `name`, `type`, `domain`, `version`, `versions`, `description`, `author`, `updatedAt`, `tags`, `warn`, `stats` (WorkflowStats), `relatedComponents` (RelatedComponent[]), `permissions` (StatePermission[]), `definition` (WorkflowDefinition).

`WorkflowStats` has: `active`, `busy`, `faulted`, `suspended`, `completed`, `stateDistribution: { state, count }[]`, `duration: { avg, min, max, p95 }`.

`StatePermission` has: `state`, `stateType: 'State' | 'SubFlow'`, `transitions: { name, roles[] }[]`, `functions: { name, roles[] }[]`.

- [ ] **Step 1: Create WorkflowDetailPage**

```tsx
// apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useWorkflowDetail, useWorkflowVersions } from '@monitoring/modules/definitions/api/definitions-queries';
import { useInstanceList } from '@monitoring/modules/instances/api/instances-queries';
import { StatusBadge } from '@monitoring/shared/components/StatusBadge';
import type { InstanceStatus } from '@monitoring/shared/types';

const WORKFLOW_TYPE_LABELS: Record<string, string> = { F: 'Flow', S: 'State', P: 'Process' };
const WORKFLOW_TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'secondary'> = {
  F: 'info',
  S: 'warning',
  P: 'secondary',
};

type Tab = 'overview' | 'definition' | 'instances' | 'performance' | 'related' | 'permissions';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'instances', label: 'Instances' },
  { id: 'performance', label: 'Performance' },
  { id: 'related', label: 'Related' },
  { id: 'permissions', label: 'Permissions' },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDuration(createdAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface WorkflowDetailPageProps {
  id: string;
}

export function WorkflowDetailPage({ id }: WorkflowDetailPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatus | 'all'>('all');
  const [instancePage, setInstancePage] = useState(1);

  const { data: workflow, isLoading } = useWorkflowDetail(id);
  const { data: versions } = useWorkflowVersions(id);
  const { data: instanceData } = useInstanceList({
    workflowId: id,
    status: instanceStatus,
    page: instancePage,
    pageSize: 10,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading workflow…
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Workflow not found
      </div>
    );
  }

  const stats = workflow.stats;

  const STATUS_OPTIONS: Array<{ label: string; value: InstanceStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'Active' },
    { label: 'Busy', value: 'Busy' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Faulted', value: 'Faulted' },
    { label: 'Suspended', value: 'Suspended' },
    { label: 'Terminated', value: 'Terminated' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{workflow.name}</h1>
            <Badge
              variant={WORKFLOW_TYPE_VARIANTS[workflow.type] ?? 'secondary'}
              className="font-mono text-xs"
            >
              {WORKFLOW_TYPE_LABELS[workflow.type] ?? workflow.type}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {workflow.domain} · {workflow.version}
          </p>
        </div>
        <VersionPicker
          currentVersion={workflow.version}
          versions={versions ?? [workflow.version]}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <p className="text-sm text-foreground">{workflow.description || 'No description.'}</p>
              {workflow.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {workflow.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-mono text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Author</span>
                <span className="font-mono text-xs">{workflow.author || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-mono text-xs">{formatDateTime(workflow.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Instance Distribution
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Active', value: stats.active },
                { label: 'Busy', value: stats.busy },
                { label: 'Faulted', value: stats.faulted },
                { label: 'Suspended', value: stats.suspended },
                { label: 'Completed', value: stats.completed },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {stats.stateDistribution.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                State Distribution
              </h2>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-2">
                  {stats.stateDistribution.map(({ state, count }) => {
                    const maxCount = Math.max(...stats.stateDistribution.map((s) => s.count));
                    const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                    return (
                      <div key={state} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 font-mono text-xs text-foreground">
                          {state}
                        </span>
                        <div className="flex-1 rounded-full bg-muted h-2">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Definition */}
      {activeTab === 'definition' && <RawJsonViewer data={workflow.definition} />}

      {/* Tab: Instances */}
      {activeTab === 'instances' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setInstanceStatus(opt.value); setInstancePage(1); }}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  instanceStatus === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm">
            {!instanceData?.items.length ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No instances found
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Instance Key', 'Version', 'State', 'Status', 'Created At', 'Duration'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {instanceData.items.map((inst) => (
                    <tr
                      key={inst.id}
                      onClick={() => navigate(`/instances/${inst.id}`)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-primary">{inst.key}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {inst.workflowVersion}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {inst.state}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inst.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {formatDateTime(inst.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {formatDuration(inst.createdAt, inst.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{instanceData?.total ?? 0} total instances</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={instancePage <= 1}
                onClick={() => setInstancePage((p) => p - 1)}
              >
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={
                  !instanceData || instancePage >= Math.ceil(instanceData.total / 10)
                }
                onClick={() => setInstancePage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/definitions/workflows/${id}/instances`)}
              className="text-xs"
            >
              View all →
            </Button>
          </div>
        </div>
      )}

      {/* Tab: Performance */}
      {activeTab === 'performance' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Avg Duration', value: stats.duration.avg },
              { label: 'Min Duration', value: stats.duration.min },
              { label: 'Max Duration', value: stats.duration.max },
              { label: 'P95 Duration', value: stats.duration.p95 },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight font-mono text-foreground">
                  {value || '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Related */}
      {activeTab === 'related' && (
        <RelatedComponentsList components={workflow.relatedComponents} />
      )}

      {/* Tab: Permissions */}
      {activeTab === 'permissions' && (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['State', 'State Type', 'Transitions', 'Functions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workflow.permissions.map((perm, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{perm.state}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={perm.stateType === 'SubFlow' ? 'info' : 'secondary'}
                      className="text-xs"
                    >
                      {perm.stateType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {perm.transitions.map((t) => (
                      <div key={t.name} className="flex items-center gap-2 text-xs">
                        <span className="font-mono">{t.name}</span>
                        <span className="text-muted-foreground">{t.roles.join(', ')}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    {perm.functions.map((f) => (
                      <div key={f.name} className="flex items-center gap-2 text-xs">
                        <span className="font-mono">{f.name}</span>
                        <span className="text-muted-foreground">{f.roles.join(', ')}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/modules/definitions/workflow/WorkflowDetailPage.tsx
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): add WorkflowDetailPage with 6 tabs (overview, definition, instances, performance, related, permissions)"
```

---

## Task 7: Simple Detail Pages (Task, Function, View, Extension, Schema, Mapping)

**Files:**
- Create: `apps/monitoring/src/modules/definitions/task/TaskDetailPage.tsx`
- Create: `apps/monitoring/src/modules/definitions/function/FunctionDetailPage.tsx`
- Create: `apps/monitoring/src/modules/definitions/view/ViewDetailPage.tsx`
- Create: `apps/monitoring/src/modules/definitions/extension/ExtensionDetailPage.tsx`
- Create: `apps/monitoring/src/modules/definitions/schema/SchemaDetailPage.tsx`
- Create: `apps/monitoring/src/modules/definitions/mapping/MappingDetailPage.tsx`

All six pages follow the same structural pattern:
1. Call `useComponentDetail(type, id)` — returns `Record<string, unknown>`
2. Show a loading state and a "not found" state
3. Render a header with name (from `data.name as string`) + `VersionPicker`
4. Render a tab bar
5. Render tab content

Use `useNavigate` only in TaskDetailPage and FunctionDetailPage (for navigation to executions).

- [ ] **Step 1: Create TaskDetailPage** (3 tabs: Overview, Definition, Executions)

```tsx
// apps/monitoring/src/modules/definitions/task/TaskDetailPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';

type Tab = 'overview' | 'definition' | 'executions';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'executions', label: 'Executions' },
];

interface TaskDetailPageProps {
  id: string;
}

export function TaskDetailPage({ id }: TaskDetailPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('task', id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading task…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Task not found
      </div>
    );
  }

  const name = (data.name as string) ?? id;
  const version = (data.version as string) ?? '—';
  const taskType = (data.taskType as string) ?? '—';
  const deprecated = Boolean(data.deprecated);
  const description = (data.description as string) ?? '';

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
            <Badge
              variant={taskType === 'Http' ? 'info' : 'secondary'}
              className="font-mono text-xs"
            >
              {taskType}
            </Badge>
            {deprecated && (
              <Badge variant="destructive" className="text-xs">
                Deprecated
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{id} · {version}</p>
        </div>
        <VersionPicker currentVersion={version} versions={[version]} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground">{description || 'No description.'}</p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Task Type</p>
              <p className="mt-1 font-mono text-sm font-medium text-foreground">{taskType}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="mt-1 font-mono text-sm font-medium text-foreground">{version}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'executions' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            View all executions for this task definition.
          </p>
          <button
            onClick={() => navigate(`/task-executions?task=${id}`)}
            className="w-fit rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40 transition-colors"
          >
            View task executions →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create FunctionDetailPage** (3 tabs: Overview, Definition, Executions)

```tsx
// apps/monitoring/src/modules/definitions/function/FunctionDetailPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';

type Tab = 'overview' | 'definition' | 'executions';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'executions', label: 'Executions' },
];

interface FunctionDetailPageProps {
  id: string;
}

export function FunctionDetailPage({ id }: FunctionDetailPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('function', id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading function…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Function not found
      </div>
    );
  }

  const name = (data.name as string) ?? id;
  const version = (data.version as string) ?? '—';
  const returnType = (data.returnType as string) ?? 'void';
  const parameters = (data.parameters as Array<{ name: string; type: string; required: boolean }>) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {id} · {version} · returns <span className="font-mono">{returnType}</span>
          </p>
        </div>
        <VersionPicker currentVersion={version} versions={[version]} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4 max-w-xs">
            <p className="text-xs text-muted-foreground">Return Type</p>
            <p className="mt-1 font-mono text-sm font-medium text-foreground">{returnType}</p>
          </div>

          {parameters.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Parameters ({parameters.length})
              </h2>
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Name', 'Type', 'Required'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parameters.map((param) => (
                      <tr key={param.name} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                          {param.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {param.type}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {param.required ? 'Yes' : 'No'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parameters.length === 0 && (
            <p className="text-sm text-muted-foreground">No parameters.</p>
          )}
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'executions' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            View all executions for this function definition.
          </p>
          <button
            onClick={() => navigate(`/function-executions?function=${id}`)}
            className="w-fit rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted/40 transition-colors"
          >
            View function executions →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ViewDetailPage** (3 tabs: Overview, Definition, Related)

```tsx
// apps/monitoring/src/modules/definitions/view/ViewDetailPage.tsx
import { useState } from 'react';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import type { RelatedComponent } from '@monitoring/shared/types';

type Tab = 'overview' | 'definition' | 'related';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'related', label: 'Related' },
];

interface ViewDetailPageProps {
  id: string;
}

export function ViewDetailPage({ id }: ViewDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('view', id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading view…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        View not found
      </div>
    );
  }

  const name = (data.name as string) ?? id;
  const version = (data.version as string) ?? '—';
  const description = (data.description as string) ?? '';
  const relatedComponents = (data.relatedComponents as RelatedComponent[]) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{id} · {version}</p>
        </div>
        <VersionPicker currentVersion={version} versions={[version]} />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{description || 'No description.'}</p>
          <div className="rounded-lg border border-border bg-muted/20 p-4 max-w-xs">
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="mt-1 font-mono text-sm font-medium text-foreground">{version}</p>
          </div>
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}
      {activeTab === 'related' && <RelatedComponentsList components={relatedComponents} />}
    </div>
  );
}
```

- [ ] **Step 4: Create ExtensionDetailPage** (3 tabs: Overview, Definition, Related)

```tsx
// apps/monitoring/src/modules/definitions/extension/ExtensionDetailPage.tsx
import { useState } from 'react';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import type { RelatedComponent } from '@monitoring/shared/types';

type Tab = 'overview' | 'definition' | 'related';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'related', label: 'Related' },
];

interface ExtensionDetailPageProps {
  id: string;
}

export function ExtensionDetailPage({ id }: ExtensionDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('extension', id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading extension…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Extension not found
      </div>
    );
  }

  const name = (data.name as string) ?? id;
  const version = (data.version as string) ?? '—';
  const description = (data.description as string) ?? '';
  const relatedComponents = (data.relatedComponents as RelatedComponent[]) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{id} · {version}</p>
        </div>
        <VersionPicker currentVersion={version} versions={[version]} />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{description || 'No description.'}</p>
          <div className="rounded-lg border border-border bg-muted/20 p-4 max-w-xs">
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="mt-1 font-mono text-sm font-medium text-foreground">{version}</p>
          </div>
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}
      {activeTab === 'related' && <RelatedComponentsList components={relatedComponents} />}
    </div>
  );
}
```

- [ ] **Step 5: Create SchemaDetailPage** (4 tabs: Overview, Definition, Test, Related)

```tsx
// apps/monitoring/src/modules/definitions/schema/SchemaDetailPage.tsx
import { useState } from 'react';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import type { RelatedComponent } from '@monitoring/shared/types';

type Tab = 'overview' | 'definition' | 'test' | 'related';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'test', label: 'Test' },
  { id: 'related', label: 'Related' },
];

interface SchemaDetailPageProps {
  id: string;
}

export function SchemaDetailPage({ id }: SchemaDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [testInput, setTestInput] = useState('{\n  \n}');
  const [testResult, setTestResult] = useState<string | null>(null);
  const { data, isLoading } = useComponentDetail('schema', id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading schema…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Schema not found
      </div>
    );
  }

  const name = (data.name as string) ?? id;
  const version = (data.version as string) ?? '—';
  const description = (data.description as string) ?? '';
  const relatedComponents = (data.relatedComponents as RelatedComponent[]) ?? [];

  function handleValidate() {
    try {
      JSON.parse(testInput);
      setTestResult('Valid JSON — schema validation requires backend integration.');
    } catch (e) {
      setTestResult(`Invalid JSON: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{id} · {version}</p>
        </div>
        <VersionPicker currentVersion={version} versions={[version]} />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{description || 'No description.'}</p>
          <div className="rounded-lg border border-border bg-muted/20 p-4 max-w-xs">
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="mt-1 font-mono text-sm font-medium text-foreground">{version}</p>
          </div>
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'test' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Paste a JSON payload below to validate it against this schema.
          </p>
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            placeholder='{ "field": "value" }'
          />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleValidate}>
              Validate
            </Button>
            {testResult && (
              <p
                className={cn(
                  'text-xs',
                  testResult.startsWith('Invalid') ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {testResult}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'related' && <RelatedComponentsList components={relatedComponents} />}
    </div>
  );
}
```

- [ ] **Step 6: Create MappingDetailPage** (4 tabs: Overview, Definition, Script, Related)

```tsx
// apps/monitoring/src/modules/definitions/mapping/MappingDetailPage.tsx
import { useState } from 'react';
import { cn } from '@monitoring/shared/lib/utils';
import { VersionPicker } from '@monitoring/modules/definitions/components/VersionPicker';
import { RawJsonViewer } from '@monitoring/modules/definitions/components/RawJsonViewer';
import { RelatedComponentsList } from '@monitoring/modules/definitions/components/RelatedComponentsList';
import { useComponentDetail } from '@monitoring/modules/definitions/api/definitions-queries';
import type { RelatedComponent } from '@monitoring/shared/types';

type Tab = 'overview' | 'definition' | 'script' | 'related';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'definition', label: 'Definition' },
  { id: 'script', label: 'Script' },
  { id: 'related', label: 'Related' },
];

interface MappingDetailPageProps {
  id: string;
}

export function MappingDetailPage({ id }: MappingDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { data, isLoading } = useComponentDetail('mapping', id);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading mapping…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Mapping not found
      </div>
    );
  }

  const name = (data.name as string) ?? id;
  const version = (data.version as string) ?? '—';
  const usedBy = (data.usedBy as string[]) ?? [];
  const script = (data.script as string) ?? JSON.stringify(data, null, 2);
  const relatedComponents = (data.relatedComponents as RelatedComponent[]) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{id} · {version}</p>
        </div>
        <VersionPicker currentVersion={version} versions={[version]} />
      </div>

      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="mt-1 font-mono text-sm font-medium text-foreground">{version}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Used By</p>
              <p className="mt-1 text-sm text-foreground">
                {usedBy.length > 0 ? usedBy.join(', ') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'definition' && <RawJsonViewer data={data} />}

      {activeTab === 'script' && (
        <pre className="max-h-[600px] overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed font-mono text-foreground">
          {script}
        </pre>
      )}

      {activeTab === 'related' && <RelatedComponentsList components={relatedComponents} />}
    </div>
  );
}
```

- [ ] **Step 7: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/modules/definitions/task/TaskDetailPage.tsx \
  apps/monitoring/src/modules/definitions/function/FunctionDetailPage.tsx \
  apps/monitoring/src/modules/definitions/view/ViewDetailPage.tsx \
  apps/monitoring/src/modules/definitions/extension/ExtensionDetailPage.tsx \
  apps/monitoring/src/modules/definitions/schema/SchemaDetailPage.tsx \
  apps/monitoring/src/modules/definitions/mapping/MappingDetailPage.tsx
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): add Task, Function, View, Extension, Schema, Mapping detail pages"
```

---

## Task 8: ComponentDetailPage Router

**Files:**
- Modify: `apps/monitoring/src/pages/ComponentDetailPage.tsx` (replace placeholder)

This page reads `:type` and `:id` from route params (set up in `AppRouter.tsx` as `definitions/:type/:id`) and dispatches to the appropriate detail page component.

- [ ] **Step 1: Replace ComponentDetailPage**

```tsx
// apps/monitoring/src/pages/ComponentDetailPage.tsx
import { useParams } from 'react-router-dom';
import { WorkflowDetailPage } from '@monitoring/modules/definitions/workflow/WorkflowDetailPage';
import { TaskDetailPage } from '@monitoring/modules/definitions/task/TaskDetailPage';
import { FunctionDetailPage } from '@monitoring/modules/definitions/function/FunctionDetailPage';
import { ViewDetailPage } from '@monitoring/modules/definitions/view/ViewDetailPage';
import { ExtensionDetailPage } from '@monitoring/modules/definitions/extension/ExtensionDetailPage';
import { SchemaDetailPage } from '@monitoring/modules/definitions/schema/SchemaDetailPage';
import { MappingDetailPage } from '@monitoring/modules/definitions/mapping/MappingDetailPage';

export function ComponentDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();

  if (!type || !id) {
    return (
      <div className="text-muted-foreground text-sm">
        Invalid route parameters
      </div>
    );
  }

  switch (type) {
    case 'workflow':
      return <WorkflowDetailPage id={id} />;
    case 'task':
      return <TaskDetailPage id={id} />;
    case 'function':
      return <FunctionDetailPage id={id} />;
    case 'view':
      return <ViewDetailPage id={id} />;
    case 'extension':
      return <ExtensionDetailPage id={id} />;
    case 'schema':
      return <SchemaDetailPage id={id} />;
    case 'mapping':
      return <MappingDetailPage id={id} />;
    default:
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
          Unknown component type: {type}
        </div>
      );
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge add \
  apps/monitoring/src/pages/ComponentDetailPage.tsx
git -C /Users/UST951/Burgan/monitoring-ui/vnext-forge commit -m "feat(monitoring): wire ComponentDetailPage router to type-specific detail pages"
```

---

## Final Verification

- [ ] **Run full TypeScript check one more time**

```bash
cd /Users/UST951/Burgan/monitoring-ui/vnext-forge
corepack pnpm --filter @vnext-forge-studio/monitoring exec tsc --noEmit
```

Expected: exit 0, no diagnostic output.

- [ ] **Smoke-test dev server**

```bash
corepack pnpm --filter @vnext-forge-studio/monitoring dev
```

Navigate to:
- `http://localhost:3100/definitions/workflow` — should render the workflow list table
- `http://localhost:3100/definitions/workflow/some-id` — should render WorkflowDetailPage (loading state if no API)
- `http://localhost:3100/definitions/task` — should render the task list table
- `http://localhost:3100/definitions/task/some-id` — should render TaskDetailPage
- `http://localhost:3100/instances` route equivalent (via a workflow: `http://localhost:3100/definitions/workflows/some-id/instances`) — should render InstanceListPage

All pages should render without React errors in the console.
