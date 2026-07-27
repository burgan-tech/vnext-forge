import type { MappingCode } from './mapping';

/**
 * Distributed-lock operation attached to a transition. Valid only for
 * start, state-level, and shared transitions — never for cancel, exit,
 * or updateData transitions (the engine does not support resource
 * locking on those manual-only lifecycle transitions).
 */
export type ResourceLockAction = 'Acquire' | 'Release' | 'Extend';

export type ResourceLockOnConflict = 'Abort';

export interface ResourceLock {
  /** Mapping script computing the distributed-lock key for this transition. */
  keyExpression: MappingCode;
  action: ResourceLockAction;
  /** Lock time-to-live in seconds. Defaults to 300 when omitted. */
  ttlSeconds?: number;
  /** Behavior when the lock cannot be acquired/extended. Defaults to 'Abort'. */
  onConflict?: ResourceLockOnConflict;
}
