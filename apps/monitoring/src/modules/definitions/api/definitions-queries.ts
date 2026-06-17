import { useQuery } from '@tanstack/react-query';
import { domainGet } from '@monitoring/shared/api/monitoring-api';
import type { Workflow } from '@monitoring/shared/types';
import type { DefinitionListItem } from '@monitoring/shared/types/definitions-api';

export type DefinitionType = 'workflow' | 'task' | 'function' | 'view' | 'extension' | 'schema' | 'mapping';

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

export function useComponentDetail(type: DefinitionType, id: string) {
  return useQuery({
    queryKey: ['definitions', type, id],
    queryFn: () => domainGet<Record<string, unknown>>(`/components/${type}s/${id}`),
    enabled: Boolean(type) && Boolean(id),
  });
}
