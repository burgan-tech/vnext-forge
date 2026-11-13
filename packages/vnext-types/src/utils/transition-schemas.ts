import { TriggerType } from '../constants/trigger-types';
import type { TransitionSchemaRuleEntry } from '../types/state';

/**
 * Rule-based transition `schemas` (vnext-schema 0.0.60 / runtime 0.0.105).
 *
 * Every transition kind may declare `schemas` next to the single `schema`:
 * entries are walked in declaration order, the first matching `rule` wins,
 * a rule-less entry is the fallback and must be last, and `schemas` wins
 * over `schema`. Automatic and scheduled transitions (and the workflow
 * timeout) may not declare it.
 */

export type TransitionSchemasIssueCode =
  | 'schemas.notAllowed'
  | 'schemas.fallbackNotLast'
  | 'schemas.shadowsSchema';

export interface TransitionSchemasIssue {
  code: TransitionSchemasIssueCode;
  severity: 'error' | 'warning';
  message: string;
  /** Owning state; absent for flow-level transitions (start, shared, cancel, …). */
  stateKey?: string;
  transitionKey?: string;
  /** Offending entry for `schemas.fallbackNotLast`. */
  entryIndex?: number;
}

/** Runtime error code when a declared `schemas` list matches no entry. */
export const TRANSITION_SCHEMA_NOT_MATCHED_CODE = 'Transition:100025';
/** Runtime error code when a function's rule-based `inputSchema` matches no entry and a body is sent. */
export const FUNCTION_INPUT_SCHEMA_NOT_MATCHED_CODE = 'Function:800006';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Entries of a raw `schemas` value: the plain array or the wrapped
 * `{ schemas: [...] }` form. `null`, absent or any other shape yields `[]`.
 */
export function transitionSchemaEntries(value: unknown): Partial<TransitionSchemaRuleEntry>[] {
  if (Array.isArray(value)) return value.map((e) => (isRecord(e) ? e : {}));
  if (isRecord(value) && Array.isArray(value.schemas)) {
    return value.schemas.map((e: unknown) => (isRecord(e) ? e : {}));
  }
  return [];
}

/** True when the transition declares a non-empty `schemas` list. */
export function hasTransitionSchemas(transition: { schemas?: unknown }): boolean {
  return transitionSchemaEntries(transition.schemas).length > 0;
}

/** True for the transitions the runtime accepts `schemas` (and `schema`) on. */
export function acceptsTransitionSchemas(transition: { triggerType?: unknown }): boolean {
  return transition.triggerType !== TriggerType.Automatic && transition.triggerType !== TriggerType.Scheduled;
}

/** Index of the first rule-less entry that is not last, or -1. */
export function findFallbackNotLastIndex(entries: readonly { rule?: unknown }[]): number {
  for (let i = 0; i < entries.length - 1; i += 1) {
    if (!isRecord(entries[i]) || entries[i].rule == null) return i;
  }
  return -1;
}

/**
 * Mirrors the runtime publish checks for `transition.schemas` (rule-less
 * entry not last; declared on an automatic / scheduled transition or the
 * timeout) and warns when `schema` is declared too, since `schemas` wins.
 */
export function transitionSchemasIssues(workflowJson: unknown): TransitionSchemasIssue[] {
  const attributes = isRecord(workflowJson) && isRecord(workflowJson.attributes) ? workflowJson.attributes : undefined;
  if (!attributes) return [];
  const issues: TransitionSchemasIssue[] = [];

  const check = (label: string, transition: unknown, stateKey: string | undefined, forbidden: boolean) => {
    if (!isRecord(transition)) return;
    const entries = transitionSchemaEntries(transition.schemas);
    if (entries.length === 0) return;
    const transitionKey = typeof transition.key === 'string' ? transition.key : '';
    const name = `The ${label}${transitionKey ? ` "${transitionKey}"` : ''}`;
    const where = { ...(stateKey ? { stateKey } : {}), transitionKey };

    if (forbidden || !acceptsTransitionSchemas(transition)) {
      issues.push({
        code: 'schemas.notAllowed',
        severity: 'error',
        ...where,
        message: `${name} declares schemas; automatic and scheduled transitions cannot.`,
      });
      return;
    }

    const fallbackIndex = findFallbackNotLastIndex(entries);
    if (fallbackIndex >= 0) {
      const after = entries.length - fallbackIndex - 1;
      issues.push({
        code: 'schemas.fallbackNotLast',
        severity: 'error',
        ...where,
        entryIndex: fallbackIndex,
        message: `${name}: schemas entry ${fallbackIndex + 1} has no rule, so it always matches and the ${after} entr${after === 1 ? 'y' : 'ies'} after it are unreachable. Move the fallback entry to the end.`,
      });
    }

    if (isRecord(transition.schema)) {
      issues.push({
        code: 'schemas.shadowsSchema',
        severity: 'warning',
        ...where,
        message: `${name} declares both schema and schemas; schemas takes precedence and schema is ignored.`,
      });
    }
  };

  check('start transition', attributes.startTransition, undefined, false);
  check('cancel transition', attributes.cancel, undefined, false);
  check('exit transition', attributes.exit, undefined, false);
  check('updateData transition', attributes.updateData, undefined, false);
  check('timeout transition', attributes.timeout, undefined, true);
  if (Array.isArray(attributes.sharedTransitions)) {
    for (const t of attributes.sharedTransitions) check('shared transition', t, undefined, false);
  }
  const states = Array.isArray(attributes.states) ? attributes.states.filter(isRecord) : [];
  for (const state of states) {
    const stateKey = typeof state.key === 'string' ? state.key : '';
    const transitions = Array.isArray(state.transitions) ? state.transitions : [];
    for (const t of transitions) check('transition', t, stateKey, false);
  }
  return issues;
}
