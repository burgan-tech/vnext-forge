import type { HumanTaskItem } from '../types/quickrun.types';
import type { OpenInstanceTarget } from './instanceTarget';

export type HumanTaskOpenAction = 'openInstance' | 'openWorkflow';

/** Same workflow → open the root instance here; another workflow → its Quick Runner. */
export function humanTaskOpenAction(row: HumanTaskItem, currentWorkflowKey: string): HumanTaskOpenAction {
  return !row.workflow || row.workflow === currentWorkflowKey ? 'openInstance' : 'openWorkflow';
}

/**
 * The row is the ROOT instance (its text comes from the leaf). `id` is the
 * root's own id — unique even for a SubProcess, whose `instanceId` is not.
 * The list only returns effectively Active instances; the first poll corrects
 * the placeholder statuses.
 */
export function instanceTargetFromHumanTask(row: HumanTaskItem, domain: string, workflowKey: string): OpenInstanceTarget {
  return {
    id: row.id,
    key: row.instanceId ?? row.id,
    domain,
    workflowKey: row.workflow ?? workflowKey,
    status: 'A',
    effectiveStatus: 'A',
    startedAt: row.createdAt,
  };
}

export function humanTaskLabel(row: HumanTaskItem): string {
  const title = row.title?.trim();
  if (title) return title;
  return row.instanceId ?? row.id;
}
