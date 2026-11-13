import { availableInStateKeys } from './available-in';

/**
 * Resource-lock publish checks (vnext-schema 0.0.61 / runtime 0.0.106).
 *
 * Mirrors `WorkflowValidator.ValidateResourceLocks` in the runtime: a TTL that
 * cannot protect anything, a Retry that can only spin on a lost lock race, a
 * state error boundary routing to a transition the instance cannot take, and a
 * lock that silently never runs because the transition is reached through an
 * error boundary.
 */

/** 409 for a lost `Acquire` race under `onConflict: Abort` (the instance faults). */
export const RESOURCE_LOCK_CONFLICT_CODE = 'Execution:200010';
/** 409 for a lost `Acquire` race under `onConflict: Reject` (the instance is untouched). */
export const RESOURCE_LOCK_REJECTED_CODE = 'Execution:200014';

const LOCK_CONFLICT_CODES = new Set([RESOURCE_LOCK_CONFLICT_CODE, RESOURCE_LOCK_REJECTED_CODE].map((c) => c.toLowerCase()));

/** ErrorAction.Retry — authored as the number; the name is accepted too. */
const ERROR_ACTION_RETRY = 1;

export type ResourceLockIssueCode =
  | 'resourceLock.ttlInvalid'
  | 'errorBoundary.retryOnLockConflict'
  | 'errorBoundary.transitionUnavailable'
  | 'errorBoundary.targetSkipsLock';

export interface ResourceLockIssue {
  code: ResourceLockIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** Owning state of the transition or error boundary; absent at flow level. */
  stateKey?: string;
  transitionKey?: string;
  /** Index of the offending `errorBoundary.onError` rule, for boundary issues. */
  ruleIndex?: number;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keyOf(value: JsonRecord): string {
  return typeof value.key === 'string' ? value.key : '';
}

/** True when an error-boundary rule names one of the resource-lock conflict codes. */
export function namesResourceLockConflict(errorCodes: unknown): boolean {
  return (
    Array.isArray(errorCodes) &&
    errorCodes.some((code) => typeof code === 'string' && LOCK_CONFLICT_CODES.has(code.toLowerCase()))
  );
}

function isRetry(action: unknown): boolean {
  return action === ERROR_ACTION_RETRY || (typeof action === 'string' && action.toLowerCase() === 'retry');
}

/** The runtime message for Retry on a lock conflict — also used inline by the boundary editor. */
export const RETRY_ON_LOCK_CONFLICT_MESSAGE =
  'Retry cannot resolve a resource-lock conflict: the step is retried while the lock is still held by another instance, so every attempt fails the same way. Route the failure to a waiting state with a scheduled retry instead, or declare onConflict "Reject" so the caller repeats the call.';

interface DefinedTransition {
  transition: JsonRecord;
  label: string;
  stateKey?: string;
}

/** Every transition the definition declares, in the runtime's enumeration order. */
function definedTransitions(attributes: JsonRecord): DefinedTransition[] {
  const result: DefinedTransition[] = [];
  const flowLevel: [string, unknown][] = [
    ['start transition', attributes.startTransition],
    ['cancel transition', attributes.cancel],
    ['updateData transition', attributes.updateData],
    ['exit transition', attributes.exit],
  ];
  for (const [label, transition] of flowLevel) {
    if (isRecord(transition)) result.push({ transition, label });
  }
  if (Array.isArray(attributes.sharedTransitions)) {
    for (const transition of attributes.sharedTransitions) {
      if (isRecord(transition)) result.push({ transition, label: 'shared transition' });
    }
  }
  for (const state of states(attributes)) {
    const stateKey = keyOf(state);
    if (!Array.isArray(state.transitions)) continue;
    for (const transition of state.transitions) {
      if (isRecord(transition)) result.push({ transition, label: 'transition', stateKey });
    }
  }
  return result;
}

function states(attributes: JsonRecord): JsonRecord[] {
  return Array.isArray(attributes.states) ? attributes.states.filter(isRecord) : [];
}

/**
 * Whether an instance sitting in `stateKey` can take `transitionKey`: one of
 * the state's own transitions, a shared transition whose `availableIn` is
 * empty or names the state, or cancel / updateData / exit (reachable from
 * anywhere). The start transition never counts.
 */
function isTransitionAvailableFrom(attributes: JsonRecord, transitionKey: string, stateKey: string): boolean {
  const state = states(attributes).find((s) => keyOf(s) === stateKey);
  if (state && Array.isArray(state.transitions) && state.transitions.some((t) => isRecord(t) && keyOf(t) === transitionKey)) {
    return true;
  }
  const shared = Array.isArray(attributes.sharedTransitions)
    ? attributes.sharedTransitions.find((t): t is JsonRecord => isRecord(t) && keyOf(t) === transitionKey)
    : undefined;
  if (shared) {
    const availableIn = availableInStateKeys(shared.availableIn);
    return availableIn.length === 0 || availableIn.includes(stateKey);
  }
  return [attributes.cancel, attributes.updateData, attributes.exit].some(
    (t) => isRecord(t) && keyOf(t) === transitionKey,
  );
}

function ttlInvalidIssues(attributes: JsonRecord): ResourceLockIssue[] {
  const issues: ResourceLockIssue[] = [];
  for (const { transition, label, stateKey } of definedTransitions(attributes)) {
    const lock = transition.resourceLock;
    if (!isRecord(lock) || lock.action === 'Release') continue;
    // Absent means the runtime default (300).
    if (lock.ttlSeconds === undefined || lock.ttlSeconds === null) continue;
    if (typeof lock.ttlSeconds === 'number' && lock.ttlSeconds > 0) continue;
    const transitionKey = keyOf(transition);
    const action = typeof lock.action === 'string' ? lock.action : 'Acquire';
    issues.push({
      code: 'resourceLock.ttlInvalid',
      severity: 'error',
      ...(stateKey ? { stateKey } : {}),
      transitionKey,
      message: `The resource lock on ${label} "${transitionKey}" needs ttlSeconds greater than 0 for action "${action}" (found ${JSON.stringify(lock.ttlSeconds)}). A lock with no lifetime cannot keep two instances apart.`,
    });
  }
  return issues;
}

function boundaryIssues(attributes: JsonRecord): ResourceLockIssue[] {
  const issues: ResourceLockIssue[] = [];
  const all = definedTransitions(attributes);
  const findTransition = (key: string) => all.find((entry) => keyOf(entry.transition) === key)?.transition;

  // Task boundaries are left out on purpose — a resource-lock failure never comes from a task.
  const boundaries: { boundary: unknown; stateKey?: string }[] = [
    { boundary: attributes.errorBoundary },
    ...states(attributes).map((state) => ({ boundary: state.errorBoundary, stateKey: keyOf(state) })),
  ];

  for (const { boundary, stateKey } of boundaries) {
    if (!isRecord(boundary) || !Array.isArray(boundary.onError)) continue;
    const where = stateKey ? `the error boundary of state "${stateKey}"` : 'the workflow error boundary';
    boundary.onError.forEach((rule, ruleIndex) => {
      if (!isRecord(rule)) return;
      const namesLock = namesResourceLockConflict(rule.errorCodes);
      const at = { ...(stateKey ? { stateKey } : {}), ruleIndex };

      if (isRetry(rule.action) && namesLock) {
        issues.push({
          code: 'errorBoundary.retryOnLockConflict',
          severity: 'error',
          ...at,
          message: `Rule ${ruleIndex + 1} of ${where}: ${RETRY_ON_LOCK_CONFLICT_MESSAGE}`,
        });
      }

      const target = typeof rule.transition === 'string' ? rule.transition : '';
      if (!target) return;

      if (stateKey !== undefined && !isTransitionAvailableFrom(attributes, target, stateKey)) {
        issues.push({
          code: 'errorBoundary.transitionUnavailable',
          // An error only for lock-conflict rules (new surface); a warning elsewhere, as in the runtime.
          severity: namesLock ? 'error' : 'warning',
          ...at,
          transitionKey: target,
          message: `Rule ${ruleIndex + 1} of ${where} routes to transition "${target}", which is not available from that state. Declare it on the state, or as a shared transition whose availableIn contains "${stateKey}".`,
        });
      }

      if (isRecord(findTransition(target)?.resourceLock)) {
        issues.push({
          code: 'errorBoundary.targetSkipsLock',
          severity: 'warning',
          ...at,
          transitionKey: target,
          message: `Transition "${target}" declares a resource lock but is the target of rule ${ruleIndex + 1} of ${where}. Transitions reached through an error boundary skip the resource-lock step, so that lock never runs on this path.`,
        });
      }
    });
  }
  return issues;
}

/** Runtime 0.0.106 resource-lock publish checks for a workflow document. */
export function resourceLockIssues(workflowJson: unknown): ResourceLockIssue[] {
  const attributes = isRecord(workflowJson) && isRecord(workflowJson.attributes) ? workflowJson.attributes : undefined;
  if (!attributes) return [];
  return [...ttlInvalidIssues(attributes), ...boundaryIssues(attributes)];
}
