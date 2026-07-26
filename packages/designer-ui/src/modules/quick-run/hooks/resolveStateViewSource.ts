import type { StateResponse } from '../types/quickrun.types';

/**
 * Decides which view (if any) should render as the state/page view for a
 * LongPoll State response.
 * - Returns `{}` (no transitionKey) when the state has its own view.
 * - Returns `{ transitionKey }` when the state is a wizard with no own view
 *   but has a stateTransition that carries a view — its view is shown as the
 *   state/page view.
 * - Returns `null` when nothing should render.
 * Does NOT consider instance status; callers combine this with their own
 * status gate.
 */
export function resolveStateViewSource(
  state: Pick<StateResponse, 'stateType' | 'view' | 'transitions'>,
): { transitionKey?: string } | null {
  if (state.view?.hasView) return {};
  if (state.stateType === 'wizard') {
    const t = state.transitions?.find(
      (tr) => tr.kind === 'stateTransition' && tr.view?.hasView === true,
    );
    if (t) return { transitionKey: t.name };
  }
  return null;
}
