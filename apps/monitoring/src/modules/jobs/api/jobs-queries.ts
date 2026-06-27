import { useQuery } from '@tanstack/react-query';
import { domainGet, workflowGet } from '@monitoring/shared/api/monitoring-api';
import type { ResolvedRange } from '@monitoring/shared/time-range';
import type { JobsResponse, WorkflowJobsResult } from '@monitoring/shared/types/jobs-api';
import { buildJobsTimeParams } from './jobs-time-params';

/** §6.2 — Domain-wide active jobs (flat list, no pagination). */
export function useDomainJobs(params: { resolved: ResolvedRange; enabled?: boolean }) {
  const { resolved, enabled = true } = params;
  const query = buildJobsTimeParams(resolved);
  return useQuery({
    queryKey: ['jobs', 'domain', resolved.from, resolved.to],
    queryFn: () => domainGet<JobsResponse>('/jobs', query),
    enabled,
  });
}

/** §6.1 — Workflow-scoped active jobs (paginated envelope). */
export function useWorkflowJobs(params: {
  workflow: string;
  resolved: ResolvedRange;
  page?: number;
  pageSize?: number;
}) {
  const { workflow, resolved, page = 1, pageSize = 20 } = params;
  const query: Record<string, string> = {
    ...buildJobsTimeParams(resolved),
    page: String(page),
    pageSize: String(pageSize),
  };
  return useQuery({
    queryKey: ['jobs', 'workflow', workflow, resolved.from, resolved.to, page, pageSize],
    queryFn: () => workflowGet<WorkflowJobsResult>(workflow, '/jobs', query),
    enabled: Boolean(workflow),
  });
}
