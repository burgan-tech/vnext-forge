import type { InstanceStatus } from '../types/quickrun.types';

/**
 * Status to show for an instance. A parent sitting in a subflow is stored as
 * `B`; the runtime's `effectiveStatus` reports the deepest active subflow's
 * status, which is what the user expects to see.
 */
export function displayStatus(meta: { status: InstanceStatus; effectiveStatus?: InstanceStatus }): InstanceStatus {
  return meta.effectiveStatus ?? meta.status;
}

export function isActiveStatus(s: InstanceStatus): boolean {
  return s === 'A' || s === 'B';
}

/** Completed, Faulted or Passive. */
export function isInactiveStatus(s: InstanceStatus): boolean {
  return s === 'C' || s === 'F' || s === 'P';
}

/**
 * The poll loop stops on every status except Busy: Active waits for the user,
 * Completed / Faulted / Passive are terminal.
 */
export function stopsPolling(s: InstanceStatus): boolean {
  return s !== 'B';
}
