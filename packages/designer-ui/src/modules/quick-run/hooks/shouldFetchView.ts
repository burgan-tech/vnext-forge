import { resolveStateViewSource } from './resolveStateViewSource';
import type { StateResponse } from '../types/quickrun.types';

type MinimalState = Pick<StateResponse, 'stateType' | 'view' | 'transitions' | 'status'>;

/**
 * Pure gate decision for whether a one-shot View fetch should run for
 * `effectiveState`. Always returns `false` when
 * `resolveStateViewSource` says there is nothing to render — no caller
 * may bypass that check.
 *
 * When `applyStatusGate` is true, the busy-state gate used by the poll
 * loop also applies: the view is only eligible while the instance is in
 * status `A`/`C`, or when the caller's own `terminate` flag says the
 * long-poll loop is stopping anyway (a terminating instance may still be
 * mid-`B` when its view becomes eligible).
 *
 * When `applyStatusGate` is false, the busy-state gate is skipped
 * entirely — used by on-demand refreshes (e.g. the manual "Retry view"
 * button) where the user is already looking at a rendered view and
 * wants it re-fetched regardless of the instance's current status.
 */
export function shouldFetchView(
  effectiveState: MinimalState,
  options: { applyStatusGate: boolean; terminate?: boolean },
): boolean {
  const viewSource = resolveStateViewSource(effectiveState);
  if (!viewSource) return false;
  if (!options.applyStatusGate) return true;
  return effectiveState.status === 'A' || effectiveState.status === 'C' || !!options.terminate;
}
