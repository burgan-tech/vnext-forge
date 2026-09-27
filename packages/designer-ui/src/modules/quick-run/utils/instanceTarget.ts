import type { InstanceListItem, InstanceStatus } from '../types/quickrun.types';

/** Everything needed to open (or focus) an instance tab. */
export interface OpenInstanceTarget {
  id: string;
  key: string;
  domain: string;
  workflowKey: string;
  /** Raw row status — drives behaviour. */
  status: InstanceStatus;
  /** Display status. */
  effectiveStatus?: InstanceStatus;
  currentState?: string;
  startedAt: string;
}

export function instanceTargetFromListItem(item: InstanceListItem): OpenInstanceTarget {
  return {
    id: item.id,
    key: item.key,
    domain: item.domain,
    workflowKey: item.flow,
    status: item.metadata.status,
    ...(item.metadata.effectiveStatus ? { effectiveStatus: item.metadata.effectiveStatus } : {}),
    currentState: item.metadata.currentState,
    startedAt: item.metadata.createdAt,
  };
}
