import type { MappingCode } from './mapping';

/**
 * Distributed-lock operation attached to a transition. Valid only for
 * start, state-level, and shared transitions — never for cancel, exit,
 * or updateData transitions (the engine does not support resource
 * locking on those manual-only lifecycle transitions).
 */
export type ResourceLockAction = 'Acquire' | 'Release' | 'Extend';

/**
 * What losing an `Acquire` race means (vnext-schema 0.0.61 / runtime 0.0.106).
 * Only `Acquire` consults it; a failed `Extend` always answers 409 `Execution:200010`.
 *
 *  - `Abort`  (default) — the instance is FAULTED, the caller gets 409 `Execution:200010`.
 *             A state / workflow `errorBoundary` rule for that code can reroute it instead.
 *  - `Reject` — the instance is untouched (no fault, no state change), the caller gets
 *             409 `Execution:200014` and can retry the same call once the lock frees.
 */
export type ResourceLockOnConflict = 'Abort' | 'Reject';

/** All `onConflict` values Forge knows, in schema order. */
export const RESOURCE_LOCK_ON_CONFLICT_VALUES: readonly ResourceLockOnConflict[] = ['Abort', 'Reject'];

export interface ResourceLock {
  /** Mapping script computing the distributed-lock key for this transition. */
  keyExpression: MappingCode;
  action: ResourceLockAction;
  /** Lock time-to-live in seconds. Defaults to 300 when omitted. */
  ttlSeconds?: number;
  /** Behavior when an `Acquire` loses the race. Defaults to 'Abort'. */
  onConflict?: ResourceLockOnConflict;
}
