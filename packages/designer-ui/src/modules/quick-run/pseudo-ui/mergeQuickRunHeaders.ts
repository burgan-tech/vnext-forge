import type { WorkflowBucketConfig } from '../QuickRunApi';

/**
 * The single header-merge rule for every Quick Run engine call.
 *
 * Priority, lowest → highest:
 *   `toolWide` → `bucketConfig.globalHeaders` → `sessionHeaders` → `extra`
 *
 * `toolWide` is the Forge-wide header set shared by the workflow runner and
 * the function runner, so an auth token is entered once and applies
 * everywhere. Per-workflow headers still override it, so existing setups keep
 * their behaviour.
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
  toolWide?: Record<string, string>,
): Record<string, string> {
  return {
    ...(toolWide ?? {}),
    ...(bucketConfig?.globalHeaders ?? {}),
    ...(sessionHeaders ?? {}),
    ...(extra ?? {}),
  };
}
