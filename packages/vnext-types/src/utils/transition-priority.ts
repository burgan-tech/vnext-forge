import { TriggerKind, TriggerType } from '../constants/trigger-types';

/**
 * Automatic transition `priority` (vnext-schema 0.0.58 / runtime 0.0.102).
 * A state's automatic transitions are evaluated by priority ascending, then
 * declaration order; the DefaultAutoTransition (`triggerKind: 10`) is always
 * last. Absent means this value — it is never written into the JSON.
 */
export const DEFAULT_AUTO_TRANSITION_PRIORITY = 100;

export type TransitionPriorityIssueCode = 'priority.notAllowed' | 'priority.invalid' | 'priority.tie';

export interface TransitionPriorityIssue {
  code: TransitionPriorityIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** Owning state; absent for flow-level transitions (start, shared, cancel, …). */
  stateKey?: string;
  transitionKey?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keyOf(value: Record<string, unknown>): string {
  return typeof value.key === 'string' ? value.key : '';
}

/** True for the transitions the runtime accepts a `priority` on. */
export function acceptsTransitionPriority(transition: { triggerType?: unknown; triggerKind?: unknown }): boolean {
  return transition.triggerType === TriggerType.Automatic && transition.triggerKind !== TriggerKind.DefaultAuto;
}

/**
 * Mirrors the runtime publish check for `transition.priority`: rejected
 * (error) anywhere but a state-level, non-default automatic transition or
 * below 1, and the publish warning for two automatic transitions of one state
 * sharing an effective priority while one of them declares it.
 */
export function transitionPriorityIssues(workflowJson: unknown): TransitionPriorityIssue[] {
  const attributes = isRecord(workflowJson) && isRecord(workflowJson.attributes) ? workflowJson.attributes : undefined;
  if (!attributes) return [];
  const issues: TransitionPriorityIssue[] = [];

  const flowLevel: [string, unknown][] = [
    ['start transition', attributes.startTransition],
    ['cancel transition', attributes.cancel],
    ['exit transition', attributes.exit],
    ['updateData transition', attributes.updateData],
    ['timeout transition', attributes.timeout],
    ...(Array.isArray(attributes.sharedTransitions)
      ? attributes.sharedTransitions.map((t): [string, unknown] => ['shared transition', t])
      : []),
  ];
  for (const [label, transition] of flowLevel) {
    if (!isRecord(transition) || transition.priority === undefined) continue;
    const transitionKey = keyOf(transition);
    issues.push({
      code: 'priority.notAllowed',
      severity: 'error',
      transitionKey,
      message: `The ${label}${transitionKey ? ` "${transitionKey}"` : ''} declares a priority; only a state's automatic transitions can.`,
    });
  }

  const states = Array.isArray(attributes.states) ? attributes.states.filter(isRecord) : [];
  for (const state of states) {
    const stateKey = keyOf(state);
    const transitions = Array.isArray(state.transitions) ? state.transitions.filter(isRecord) : [];
    const byPriority = new Map<number, { key: string; explicit: boolean }[]>();

    for (const transition of transitions) {
      const transitionKey = keyOf(transition);
      const declared = transition.priority;
      if (declared !== undefined && !acceptsTransitionPriority(transition)) {
        const why = transition.triggerType === TriggerType.Automatic ? 'the default automatic transition is always evaluated last' : 'only automatic transitions are ordered';
        issues.push({
          code: 'priority.notAllowed',
          severity: 'error',
          stateKey,
          transitionKey,
          message: `Transition "${transitionKey}" in "${stateKey}" declares a priority, but ${why}.`,
        });
        continue;
      }
      if (declared !== undefined && !(typeof declared === 'number' && Number.isInteger(declared) && declared >= 1)) {
        issues.push({
          code: 'priority.invalid',
          severity: 'error',
          stateKey,
          transitionKey,
          message: `Transition "${transitionKey}" in "${stateKey}": priority must be a whole number of at least 1.`,
        });
        continue;
      }
      if (!acceptsTransitionPriority(transition)) continue;
      const effective = typeof declared === 'number' ? declared : DEFAULT_AUTO_TRANSITION_PRIORITY;
      const group = byPriority.get(effective) ?? [];
      group.push({ key: transitionKey, explicit: declared !== undefined });
      byPriority.set(effective, group);
    }

    for (const [priority, group] of byPriority) {
      if (group.length < 2 || !group.some((entry) => entry.explicit)) continue;
      issues.push({
        code: 'priority.tie',
        severity: 'warning',
        stateKey,
        transitionKey: group.find((entry) => entry.explicit)!.key,
        message: `Automatic transitions ${group.map((entry) => `"${entry.key}"`).join(', ')} in "${stateKey}" share priority ${priority}; declaration order decides between them.`,
      });
    }
  }
  return issues;
}

/**
 * A state's automatic transitions in the order the runtime evaluates them:
 * priority ascending, declaration order on ties, the default one last.
 */
export function autoTransitionEvaluationOrder<T extends { triggerType?: unknown; triggerKind?: unknown; priority?: unknown }>(
  transitions: readonly T[],
): T[] {
  const automatic = transitions
    .map((transition, index) => ({ transition, index }))
    .filter(({ transition }) => transition.triggerType === TriggerType.Automatic);
  const rank = (t: T) =>
    t.triggerKind === TriggerKind.DefaultAuto
      ? Number.POSITIVE_INFINITY
      : typeof t.priority === 'number'
        ? t.priority
        : DEFAULT_AUTO_TRANSITION_PRIORITY;
  return automatic
    .sort((a, b) => rank(a.transition) - rank(b.transition) || a.index - b.index)
    .map(({ transition }) => transition);
}
