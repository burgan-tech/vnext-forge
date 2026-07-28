import type { WorkflowBucketConfig } from '../QuickRunApi';

/**
 * The single header-merge rule for every Quick Run engine call.
 *
 * Priority, lowest → highest:
 *   `bucketConfig.globalHeaders` → `sessionHeaders` → `extra`
 *
 * `extra` exists for the per-transition delta the manual TransitionDialog
 * persists; ordinary callers omit it.
 *
 * Quick Run is the client's mini-simulation surface, so Global Headers must
 * ride along on *every* request it makes — transitions, function calls made
 * while rendering a view (`x-lov` lookups), function dispatches, and
 * flow-start. Anything that talks to the engine goes through here.
 */
export function mergeQuickRunHeaders(
  bucketConfig: WorkflowBucketConfig | null | undefined,
  sessionHeaders: Record<string, string> | undefined,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    ...(bucketConfig?.globalHeaders ?? {}),
    ...(sessionHeaders ?? {}),
    ...(extra ?? {}),
  };
}
