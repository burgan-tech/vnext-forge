import { RUNTIME_START_STATE } from '../../canvas-interaction/utils/executionOverlay';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';

/**
 * A minimal definition drawn from history alone, for when the local workflow
 * file is missing: every state and transition the instance went through, in
 * the semi-flat shape `toFlowCanvasJson` accepts. The start state is the
 * `$start` row's target, or else the first state the path leaves.
 */
export function buildHistoryOnlyDefinition(
  workflowKey: string,
  history: readonly HistoryTransition[],
): Record<string, unknown> {
  const order: string[] = [];
  const transitions = new Map<string, Map<string, string>>();
  const touch = (state: string) => {
    if (state && state !== RUNTIME_START_STATE && !order.includes(state)) order.push(state);
  };

  for (const t of history) {
    touch(t.fromState);
    touch(t.toState);
    if (t.fromState === RUNTIME_START_STATE) continue;
    const out = transitions.get(t.fromState) ?? new Map<string, string>();
    if (!out.has(t.transitionId)) out.set(t.transitionId, t.toState);
    transitions.set(t.fromState, out);
  }

  const startState =
    history.find((t) => t.fromState === RUNTIME_START_STATE)?.toState ?? history[0]?.fromState ?? order[0];

  return {
    key: workflowKey,
    states: order.map((key) => ({
      key,
      stateType: key === startState ? 1 : 2,
      transitions: [...(transitions.get(key) ?? new Map<string, string>())].map(([tKey, target]) => ({
        key: tKey,
        target,
        triggerType: 0,
      })),
    })),
  };
}
