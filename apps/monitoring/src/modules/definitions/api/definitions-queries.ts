import { useQuery } from '@tanstack/react-query';
import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { Workflow, StatePermission } from '@monitoring/shared/types';
import type {
  DefinitionListItem,
  ApiComponentListResponse,
  ApiComponentListItem,
  ApiComponentDetailResponse,
  ApiComponentDefinitionResponse,
} from '@monitoring/shared/types/definitions-api';

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

// workflow type.value → WorkflowType letter
const WORKFLOW_TYPE_VALUE_MAP: Record<number, string> = { 1: 'F', 2: 'S', 3: 'P' };

function pickLabel(labels?: { language: string; label: string }[], fallback = ''): string {
  if (!labels?.length) return fallback;
  return (
    labels.find((l) => l.language === 'en')?.label ??
    labels.find((l) => l.language === 'tr')?.label ??
    labels[0].label
  );
}

function mapToDefinitionListItem(item: ApiComponentListItem): DefinitionListItem {
  return {
    id: item.key,
    name: pickLabel(item.labels, item.key),
    version: item.version,
    domain: item.domain,
    type: item.type ? (WORKFLOW_TYPE_VALUE_MAP[item.type.value] ?? String(item.type.value)) : undefined,
    comment: item.comment ?? undefined,
    description: item.comment ?? undefined,
  };
}

/** API §2.1 — list all components of a given type */
export function useDefinitionList(type: DefinitionType) {
  const apiType = DEFINITION_TYPE_API_MAP[type];
  return useQuery({
    queryKey: ['definitions', type],
    queryFn: async () => {
      const res = await domainGet<ApiComponentListResponse>('/components', { type: apiType });
      return res.items.map(mapToDefinitionListItem);
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
        type: (res.type ? (WORKFLOW_TYPE_VALUE_MAP[res.type.value] ?? 'F') : 'F') as Workflow['type'],
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
