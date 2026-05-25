import * as QuickRunApi from '../QuickRunApi';
import type {
  TransitionBucketEntry,
  WorkflowBucketConfig,
} from '../QuickRunApi';

type ApiResponse<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: { code: string; message: string; details?: Record<string, unknown> };
    };

export type FireTransitionResult = { id: string; key: string; status: string };

export interface FirePseudoUiTransitionParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  transitionKey: string;
  /** Form data captured by the pseudo-ui view. Wire as `attributes`. */
  formData: Record<string, unknown>;
  /** Snapshot of the persisted workflow config (live read at call time). */
  bucketConfig: WorkflowBucketConfig | null;
  /** Session-level header overrides from the current quick-run tab. */
  sessionHeaders?: Record<string, string>;
  runtimeUrl?: string;
  /**
   * Persist the updated config on successful fire. Pseudo-ui submit
   * does not collect headers — only the body is overwritten with the
   * latest `formData`; existing `headers`, `queryStrings`, `key`,
   * `stage`, and `tags` for that transition are preserved. This
   * keeps the manual TransitionDialog's per-transition delta intact.
   *
   * Persist errors are caught and reported via `onPersistError` (if
   * provided) but never fail the overall fire — the engine call has
   * already succeeded by then.
   */
  persist?: (next: WorkflowBucketConfig) => Promise<void> | void;
  onPersistError?: (err: unknown) => void;
}

/**
 * Shared submit-from-pseudo-ui fire path that mirrors the manual
 * `TransitionDialog` so a pseudo-ui Button click and a "Fire
 * Transition" click produce the same wire request and leave the
 * persisted `WorkflowBucketConfig` in the same shape.
 *
 * Header merge order (lowest → highest priority): `globalHeaders` →
 * `sessionHeaders` → persisted `transitions[idx].headers` (the
 * per-transition delta the manual dialog writes). Pseudo-ui itself
 * doesn't add headers.
 *
 * Attributes: `formData` only (instance data is *not* merged in;
 * matches the manual dialog default).
 */
export async function firePseudoUiTransition(
  p: FirePseudoUiTransitionParams,
): Promise<ApiResponse<FireTransitionResult>> {
  const globalHeaders = p.bucketConfig?.globalHeaders ?? {};
  const sessionHeaders = p.sessionHeaders ?? {};
  const prevEntry: TransitionBucketEntry | undefined = p.bucketConfig?.transitions?.find(
    (t) => t.key === p.transitionKey,
  );
  const perTransitionHeaders = prevEntry?.headers ?? {};

  const mergedHeaders: Record<string, string> = {
    ...globalHeaders,
    ...sessionHeaders,
    ...perTransitionHeaders,
  };

  const result = await QuickRunApi.fireTransition({
    domain: p.domain,
    workflowKey: p.workflowKey,
    instanceId: p.instanceId,
    transitionKey: p.transitionKey,
    attributes: p.formData,
    headers: mergedHeaders,
    runtimeUrl: p.runtimeUrl,
  });

  if (!result.success) return result;

  if (p.persist && p.bucketConfig) {
    try {
      const cfg = p.bucketConfig;
      const transitions = [...cfg.transitions];
      const idx = transitions.findIndex((t) => t.key === p.transitionKey);
      const nextEntry: TransitionBucketEntry = {
        key: p.transitionKey,
        headers: prevEntry?.headers ?? {},
        queryStrings: prevEntry?.queryStrings ?? {},
        body: {
          // Preserve previously-persisted body metadata (key / stage /
          // tags); pseudo-ui submit only owns `attributes`. The manual
          // dialog still owns the rest and can edit independently.
          key: prevEntry?.body.key,
          stage: prevEntry?.body.stage,
          tags: prevEntry?.body.tags,
          attributes: p.formData,
        },
      };
      if (idx >= 0) {
        transitions[idx] = nextEntry;
      } else {
        transitions.push(nextEntry);
      }
      await p.persist({ ...cfg, transitions });
    } catch (err) {
      // Persist is best-effort: the engine has already accepted the
      // transition, so don't tear that down because we couldn't
      // write to the bucket store.
      p.onPersistError?.(err);
    }
  }

  return result;
}
