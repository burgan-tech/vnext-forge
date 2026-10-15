import { StateSubType, StateType } from '../constants/state-types';
import { TriggerType } from '../constants/trigger-types';

/**
 * Workflow `attributes.history` (vnext-schema 0.0.56 / runtime 0.0.100).
 * `none` marks a one-shot flow: the runtime writes no transition / task
 * history rows and a single data row (at Finish, at a SubFlow handoff or on a
 * fault). Absent means `full`.
 */
export type HistoryMode = 'none' | 'full';

export const HISTORY_MODES: readonly HistoryMode[] = ['full', 'none'];

export function readHistoryMode(workflowJson: unknown): HistoryMode {
  const attributes = isRecord(workflowJson) ? workflowJson.attributes : undefined;
  return isRecord(attributes) && attributes.history === 'none' ? 'none' : 'full';
}

export type HistoryNoneIssueCode =
  | 'history.flowTransition'
  | 'history.sharedTransitions'
  | 'history.noFinish'
  | 'history.wizardState'
  | 'history.waitingSubType'
  | 'history.longPoll'
  | 'history.manualTrigger'
  | 'history.subFlowTimeout'
  | 'history.noTransitions'
  | 'history.cannotFinish';

export interface HistoryNoneIssue {
  code: HistoryNoneIssueCode;
  message: string;
  /** State the issue belongs to, when it is state-scoped. */
  stateKey?: string;
  /** Transition the issue belongs to (with `stateKey`). */
  transitionKey?: string;
}

const WAITING_SUBTYPES = new Set<number>([StateSubType.Suspended, StateSubType.Busy, StateSubType.Human]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keyOf(value: Record<string, unknown>): string {
  return typeof value.key === 'string' ? value.key : '';
}

/**
 * Rules a `history: none` flow must satisfy: the vnext-schema 0.0.56 shape
 * rules plus the runtime's publish check that every state can reach a Finish
 * state. Empty for `full` flows. The SubFlow-child rule needs the children's
 * definitions; see {@link subFlowChildRefs}.
 */
export function historyNoneIssues(workflowJson: unknown): HistoryNoneIssue[] {
  if (readHistoryMode(workflowJson) !== 'none' || !isRecord(workflowJson)) return [];
  const attributes = workflowJson.attributes as Record<string, unknown>;
  const issues: HistoryNoneIssue[] = [];

  for (const key of ['timeout', 'cancel', 'exit', 'updateData'] as const) {
    if (attributes[key] !== undefined && attributes[key] !== null) {
      issues.push({
        code: 'history.flowTransition',
        message: `A history: none flow cannot declare a flow-level ${key} transition.`,
      });
    }
  }
  if (Array.isArray(attributes.sharedTransitions) && attributes.sharedTransitions.length > 0) {
    issues.push({ code: 'history.sharedTransitions', message: 'A history: none flow cannot have shared transitions.' });
  }

  const states = Array.isArray(attributes.states) ? attributes.states.filter(isRecord) : [];
  if (!states.some((state) => state.stateType === StateType.Final)) {
    issues.push({ code: 'history.noFinish', message: 'A history: none flow needs at least one Finish state.' });
  }

  for (const state of states) {
    const stateKey = keyOf(state);
    if (state.stateType === StateType.Wizard) {
      issues.push({ code: 'history.wizardState', stateKey, message: `State ${stateKey}: Wizard states wait for input; a history: none flow cannot have them.` });
    }
    if (typeof state.subType === 'number' && WAITING_SUBTYPES.has(state.subType)) {
      issues.push({ code: 'history.waitingSubType', stateKey, message: `State ${stateKey}: Suspended, Busy and Human sub-types wait; a history: none flow cannot use them.` });
    }
    if (isRecord(state.interaction) && state.interaction.longPoll !== undefined) {
      issues.push({ code: 'history.longPoll', stateKey, message: `State ${stateKey}: long polling is not available in a history: none flow.` });
    }
    const subFlow = isRecord(state.subFlow) ? state.subFlow : undefined;
    const overrides = subFlow && isRecord(subFlow.overrides) ? subFlow.overrides : undefined;
    if (overrides && overrides.timeout !== undefined && overrides.timeout !== null) {
      issues.push({ code: 'history.subFlowTimeout', stateKey, message: `State ${stateKey}: a history: none flow cannot override the SubFlow timeout.` });
    }
    const transitions = Array.isArray(state.transitions) ? state.transitions.filter(isRecord) : [];
    if (state.stateType !== StateType.Final && transitions.length === 0) {
      issues.push({ code: 'history.noTransitions', stateKey, message: `State ${stateKey} has no transitions; every non-Finish state of a history: none flow must move on.` });
    }
    for (const transition of transitions) {
      if (transition.triggerType !== TriggerType.Automatic) {
        const transitionKey = keyOf(transition);
        issues.push({
          code: 'history.manualTrigger',
          stateKey,
          transitionKey,
          message: `Transition ${transitionKey} in ${stateKey} must be Automatic in a history: none flow.`,
        });
      }
    }
  }

  for (const stateKey of statesThatCannotFinish(states)) {
    issues.push({
      code: 'history.cannotFinish',
      stateKey,
      message: `State ${stateKey} cannot reach a Finish state (dead end or cycle); the runtime rejects this at publish.`,
    });
  }
  return issues;
}

/** States from which no transition path leads to a Finish state. */
function statesThatCannotFinish(states: Record<string, unknown>[]): string[] {
  const byKey = new Map(states.map((state) => [keyOf(state), state]));
  const canFinish = new Set(states.filter((s) => s.stateType === StateType.Final).map(keyOf));
  let changed = true;
  while (changed) {
    changed = false;
    for (const state of states) {
      const key = keyOf(state);
      if (canFinish.has(key)) continue;
      const targets = (Array.isArray(state.transitions) ? state.transitions.filter(isRecord) : []).map((t) =>
        t.target === '$self' ? key : typeof t.target === 'string' ? t.target : '',
      );
      if (targets.some((target) => canFinish.has(target) && byKey.has(target))) {
        canFinish.add(key);
        changed = true;
      }
    }
  }
  return states.map(keyOf).filter((key) => key !== '' && !canFinish.has(key));
}

export interface SubFlowChildRef {
  stateKey: string;
  key: string;
  domain?: string;
}

/**
 * SubFlow (`type: 'S'`) children of a flow. A `none` parent's SubFlow child
 * must itself be `none` (runtime `Instance:100044` at start); SubProcess
 * (`'P'`) children are exempt.
 */
export function subFlowChildRefs(workflowJson: unknown): SubFlowChildRef[] {
  const attributes = isRecord(workflowJson) ? workflowJson.attributes : undefined;
  const states = isRecord(attributes) && Array.isArray(attributes.states) ? attributes.states.filter(isRecord) : [];
  const refs: SubFlowChildRef[] = [];
  for (const state of states) {
    const subFlow = isRecord(state.subFlow) ? state.subFlow : undefined;
    if (!subFlow || subFlow.type === 'P' || !isRecord(subFlow.process)) continue;
    const key = typeof subFlow.process.key === 'string' ? subFlow.process.key : '';
    if (!key) continue;
    refs.push({
      stateKey: keyOf(state),
      key,
      ...(typeof subFlow.process.domain === 'string' ? { domain: subFlow.process.domain } : {}),
    });
  }
  return refs;
}
