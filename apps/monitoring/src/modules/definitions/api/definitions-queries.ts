import { useQuery } from '@tanstack/react-query';
import { domainGet, workflowGet } from '@monitoring/shared/api/monitoring-api';
import type { Workflow, StatePermission } from '@monitoring/shared/types';
import type {
  DefinitionListItem,
  ApiComponentListResponse,
  ApiComponentListItem,
  ApiComponentDetailResponse,
  ApiComponentDefinitionResponse,
  WorkflowInstanceStats,
  WorkflowStateDistribution,
  WorkflowDurationStats,
  WorkflowFaultStats,
  WorkflowTaskStats,
  WorkflowPermissionsMatrix,
  WorkflowDependencies,
  WorkflowDefinitionItem,
} from '@monitoring/shared/types/definitions-api';
import { TASK_TYPE_MAP, VIEW_TYPE_MAP, SCOPE_MAP } from '@monitoring/shared/types/definitions-api';

export type DefinitionType =
  | 'workflow'
  | 'task'
  | 'function'
  | 'view'
  | 'extension'
  | 'schema'
  | 'mapping';

// DefinitionType → API type param (§2.1)
const DEFINITION_TYPE_API_MAP: Record<DefinitionType, string> = {
  workflow: 'sys-flows',
  task: 'sys-tasks',
  function: 'sys-functions',
  view: 'sys-views',
  extension: 'sys-extensions',
  schema: 'sys-schemas',
  mapping: 'sys-mappings',
};

function pickLabel(labels?: { language: string; label: string }[], fallback = ''): string {
  if (!labels?.length) return fallback;
  return (
    labels.find((l) => l.language === 'en-US')?.label ??
    labels.find((l) => l.language === 'tr-TR')?.label ??
    labels.find((l) => l.language.startsWith('en'))?.label ??
    labels.find((l) => l.language.startsWith('tr'))?.label ??
    labels[0].label
  );
}

function mapToDefinitionListItem(item: ApiComponentListItem, apiType: string): DefinitionListItem {
  const rawType = item.type;
  const numericType = typeof rawType === 'number' ? rawType : (rawType != null ? parseInt(String(rawType), 10) : NaN);
  const isNumericType = !isNaN(numericType);

  // Determine which numeric map to use based on component type
  let mappedTypeName: string | undefined;
  if (isNumericType && apiType === 'sys-tasks') {
    mappedTypeName = TASK_TYPE_MAP[numericType];
  } else if (isNumericType && apiType === 'sys-views') {
    mappedTypeName = VIEW_TYPE_MAP[numericType];
  }

  const scopeName = item.scope && SCOPE_MAP[item.scope] ? SCOPE_MAP[item.scope] : item.scope;

  return {
    id: item.key,
    name: pickLabel(item.labels, item.key),
    version: item.version,
    domain: item.domain,
    type: mappedTypeName ?? (isNumericType ? undefined : (rawType as string | undefined) ?? undefined),
    comment: item.comment ?? undefined,
    description: item.comment ?? undefined,
    scope: scopeName ?? undefined,
    display: item.display ?? undefined,
    renderer: item.renderer ?? undefined,
    labels: item.labels ?? undefined,
    taskType: apiType === 'sys-tasks' && isNumericType ? mappedTypeName : undefined,
  };
}

export interface DefinitionListPage {
  items: DefinitionListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** API §2.1 — paginated list of components of a given type (pageSize=20 default) */
export function useDefinitionList(type: DefinitionType, page = 1, pageSize = 20) {
  const apiType = DEFINITION_TYPE_API_MAP[type];
  return useQuery({
    queryKey: ['definitions', type, page, pageSize],
    queryFn: async (): Promise<DefinitionListPage> => {
      const res = await domainGet<ApiComponentListResponse>('/components', {
        type: apiType,
        page: String(page),
        pageSize: String(pageSize),
      });
      return {
        items: res.items.map((item) => mapToDefinitionListItem(item, apiType)),
        totalCount: res.totalCount,
        page: res.page,
        pageSize: res.pageSize,
        totalPages: res.totalPages,
      };
    },
    enabled: Boolean(type),
  });
}

/** API §2.1 (with key) — summary detail + versions array */
export function useWorkflowSummary(key: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow-summary', key],
    queryFn: () =>
      domainGet<ApiComponentDetailResponse>('/components', {
        type: 'sys-flows',
        key,
      }),
    enabled: Boolean(key),
  });
}

/** API §2.2 — full JSON definition (states, transitions, …) */
export function useWorkflowDefinition(key: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow-definition', key],
    queryFn: async () => {
      const res = await domainGet<ApiComponentDefinitionResponse>('/components/definition', {
        type: 'sys-flows',
        key,
      });
      return res.items[0] ?? null;
    },
    enabled: Boolean(key),
  });
}

/** Legacy: kept for WorkflowDetailPage compatibility — fetches summary and casts to Workflow */
export function useWorkflowDetail(id: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', id],
    queryFn: async () => {
      const res = await domainGet<ApiComponentDetailResponse>('/components', {
        type: 'sys-flows',
        key: id,
      });
      // Map API response to Workflow shape (best-effort; stats/permissions fetched separately)
      return {
        id: res.key,
        name: pickLabel(res.labels, res.key),
        type: (res.type ?? 'F') as Workflow['type'],
        domain: res.domain,
        version: res.version,
        versions: res.versions ?? [],
        description: res.comment ?? '',
        author: '',
        updatedAt: '',
        tags: [],
        warn: undefined,
        stats: {
          active: 0, busy: 0, faulted: 0, suspended: 0, completed: 0,
          stateDistribution: [] as { state: string; count: number }[],
          duration: { avg: '—', min: '—', max: '—', p95: '—' },
        },
        relatedComponents: [],
        permissions: [] as StatePermission[],
        definition: {},
      } satisfies Workflow;
    },
    enabled: Boolean(id),
  });
}

/** Legacy: kept for WorkflowDetailPage — versions come from summary response */
export function useWorkflowVersions(id: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', id, 'versions'],
    queryFn: async () => {
      const res = await domainGet<ApiComponentDetailResponse>('/components', {
        type: 'sys-flows',
        key: id,
      });
      return res.versions ?? [];
    },
    enabled: Boolean(id),
  });
}

/** API §3.1 — Instance counts (active/busy/faulted/passive/completed/total) for a workflow */
export function useWorkflowStats(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'stats'],
    queryFn: () => workflowGet<WorkflowInstanceStats>(workflowKey, '/stats/instances'),
    enabled: Boolean(workflowKey),
  });
}

/** API §3.3 — Active instance distribution across states */
export function useWorkflowStateDistribution(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'states'],
    queryFn: () => workflowGet<WorkflowStateDistribution>(workflowKey, '/stats/states'),
    enabled: Boolean(workflowKey),
  });
}

/** API §3.6 — Completion duration stats (avg/min/max/p95 in ms) */
export function useWorkflowDuration(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'duration'],
    queryFn: () => workflowGet<WorkflowDurationStats>(workflowKey, '/stats/duration'),
    enabled: Boolean(workflowKey),
  });
}

/** API §3.4 — Fault stats (by state / by task / trend) */
export function useWorkflowFaultStats(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'fault-stats'],
    queryFn: () => workflowGet<WorkflowFaultStats>(workflowKey, '/stats/faults'),
    enabled: Boolean(workflowKey),
  });
}

/** API §3.5 — Task execution counts and success/failure rates */
export function useWorkflowTaskStats(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'task-stats'],
    queryFn: () => workflowGet<WorkflowTaskStats>(workflowKey, '/stats/tasks'),
    enabled: Boolean(workflowKey),
  });
}

/** API §4.1 — Full workflow permission matrix (query roles, state roles, transitions, functions) */
export function useWorkflowPermissionMatrix(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'permissions'],
    queryFn: () => workflowGet<WorkflowPermissionsMatrix>(workflowKey, '/permissions'),
    enabled: Boolean(workflowKey),
  });
}

/** API §2.4 — All component dependencies used by the workflow */
export function useWorkflowDependencies(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'dependencies'],
    queryFn: () => workflowGet<WorkflowDependencies>(workflowKey, '/dependencies'),
    enabled: Boolean(workflowKey),
  });
}

/** API §2.2 (typed) — Full workflow definition JSON (states, transitions, …) */
export function useWorkflowDefinitionDetail(workflowKey: string) {
  return useQuery({
    queryKey: ['definitions', 'workflow', workflowKey, 'definition-detail'],
    queryFn: async () => {
      const res = await domainGet<ApiComponentDefinitionResponse>('/components/definition', {
        type: 'sys-flows',
        key: workflowKey,
      });
      return (res.items[0] ?? null) as WorkflowDefinitionItem | null;
    },
    enabled: Boolean(workflowKey),
  });
}

/** API §2.2 — full definition for any component type */
export function useComponentDetail(type: DefinitionType, id: string) {
  const apiType = DEFINITION_TYPE_API_MAP[type];
  return useQuery({
    queryKey: ['definitions', type, id],
    queryFn: async () => {
      const res = await domainGet<ApiComponentDefinitionResponse>('/components/definition', {
        type: apiType,
        key: id,
      });
      return res.items[0] ?? ({} as Record<string, unknown>);
    },
    enabled: Boolean(type) && Boolean(id),
  });
}
