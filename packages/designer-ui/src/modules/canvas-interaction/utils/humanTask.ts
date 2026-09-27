import { availableInStateKeys } from '@vnext-forge-studio/vnext-types';
import { isRec } from './isRec';

/**
 * Human-task rules the designer mirrors from the runtime
 * (vnext docs/runtime/human-task-function.md): an instance is listed while it
 * waits in its OWN state with subType 6 (never a Final or SubFlow state), and
 * the list is gated by the state queryRoles, else the workflow root
 * queryRoles — failing closed when neither declares any.
 */

export const HUMAN_SUBTYPE = 6;
const STATE_TYPE_FINAL = 3;
const STATE_TYPE_SUBFLOW = 4;
const TRIGGER_MANUAL = 0;

export interface HumanTaskStateLike {
  stateType?: unknown;
  subType?: unknown;
  queryRoles?: unknown;
}

type Rec = Record<string, unknown>;

export function isHumanTaskState(state: HumanTaskStateLike): boolean {
  return (
    state.subType === HUMAN_SUBTYPE &&
    state.stateType !== STATE_TYPE_FINAL &&
    state.stateType !== STATE_TYPE_SUBFLOW
  );
}

export function hasRoleGrants(roles: unknown): boolean {
  return (
    Array.isArray(roles) &&
    roles.some((grant) => isRec(grant) && typeof grant.role === 'string' && grant.role.trim() !== '')
  );
}

export function isHumanTaskGateMissing(state: HumanTaskStateLike, workflowQueryRoles: unknown): boolean {
  return isHumanTaskState(state) && !hasRoleGrants(state.queryRoles) && !hasRoleGrants(workflowQueryRoles);
}

export type OfferedTransitionSource = 'state' | 'shared' | 'cancel' | 'exit' | 'updateData';

export interface OfferedTransition {
  key: string;
  source: OfferedTransitionSource;
}

function isManual(transition: Rec): boolean {
  return transition.triggerType === undefined || transition.triggerType === TRIGGER_MANUAL;
}

function availableIn(transition: Rec, stateKey: string): boolean {
  const keys = availableInStateKeys(transition.availableIn);
  return keys.length === 0 || keys.includes(stateKey);
}

/**
 * Transitions the state function can offer a caller in `stateKey`: manual
 * state transitions, manual shared transitions available there, and the
 * cancel / exit / updateData lifecycle transitions available there. Which of
 * them a caller actually sees is decided by roles at open time.
 */
export function offeredTransitionsForState(attributes: unknown, stateKey: string): OfferedTransition[] {
  if (!isRec(attributes)) return [];
  const offered: OfferedTransition[] = [];

  const states: unknown[] = Array.isArray(attributes.states) ? attributes.states : [];
  const state = states.find((s) => isRec(s) && s.key === stateKey);
  if (isRec(state) && Array.isArray(state.transitions)) {
    for (const t of state.transitions as unknown[]) {
      if (isRec(t) && typeof t.key === 'string' && isManual(t)) offered.push({ key: t.key, source: 'state' });
    }
  }

  if (Array.isArray(attributes.sharedTransitions)) {
    for (const t of attributes.sharedTransitions as unknown[]) {
      if (isRec(t) && typeof t.key === 'string' && isManual(t) && availableIn(t, stateKey)) {
        offered.push({ key: t.key, source: 'shared' });
      }
    }
  }

  for (const source of ['cancel', 'exit', 'updateData'] as const) {
    const t = attributes[source];
    if (isRec(t) && typeof t.key === 'string' && availableIn(t, stateKey)) offered.push({ key: t.key, source });
  }

  return offered;
}

/** C# mapping body that fills the text the human-task list shows. */
export const HUMAN_TASK_MAPPING_SNIPPET = [
  'dynamic humanTask = new ExpandoObject();',
  'humanTask.title = "Approve the application";',
  'humanTask.description = "Review the request and approve or reject it";',
  '',
  'dynamic data = new ExpandoObject();',
  'data.humanTask = humanTask;',
  'return Task.FromResult(new ScriptResponse { Data = data });',
].join('\n');
