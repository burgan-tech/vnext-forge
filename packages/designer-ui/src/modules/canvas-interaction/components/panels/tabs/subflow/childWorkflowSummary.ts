/**
 * Reduces a child workflow definition to what the parent's subflow override
 * editors need: state keys (with their long-poll arm and the view keys their
 * rules can select) and transition keys (with their view keys). Pure — the
 * loading lives in `useChildWorkflowSummary`.
 */

import { isRec } from '../../../../utils/isRec';

export type ChildWorkflowLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface ChildStateSummary {
  key: string;
  /** `null` when the state declares no `interaction.longPoll`. */
  longPollAuth: 'roles' | 'rule' | null;
  viewKeys: string[];
}

export interface ChildTransitionSummary {
  key: string;
  viewKeys: string[];
}

export interface ChildWorkflowSummary {
  states: ChildStateSummary[];
  transitions: ChildTransitionSummary[];
}

export interface ChildWorkflowLoad {
  status: ChildWorkflowLoadStatus;
  summary: ChildWorkflowSummary | null;
}

type Rec = Record<string, unknown>;

/**
 * Collects the view key off a single binding (`{ view: reference, ... }`, the
 * shape both the plain form and each rules-form entry share).
 */
function pushViewKey(binding: unknown, keys: string[]): void {
  if (!isRec(binding) || !isRec(binding.view)) return;
  const key = binding.view.key;
  if (typeof key === 'string' && key !== '' && !keys.includes(key)) keys.push(key);
}

/**
 * `view` (state/transition) or an entry of `views` can also be the schema's
 * rules form — `{ rules: [{ rule, view }], default?: { view } }` — instead of
 * a plain `{ view }` binding. Collect both `rules[].view.key` and
 * `default.view.key` there too.
 */
function pushRulesFormViewKeys(binding: unknown, keys: string[]): void {
  if (!isRec(binding) || !Array.isArray(binding.rules)) return;
  for (const rule of binding.rules as unknown[]) pushViewKey(rule, keys);
  if (isRec(binding.default)) pushViewKey(binding.default, keys);
}

function viewKeysOf(holder: Rec): string[] {
  const keys: string[] = [];
  pushViewKey(holder.view, keys);
  pushRulesFormViewKeys(holder.view, keys);
  if (Array.isArray(holder.views)) {
    for (const binding of holder.views as unknown[]) {
      pushViewKey(binding, keys);
      pushRulesFormViewKeys(binding, keys);
    }
  }
  return keys;
}

function longPollAuthOf(state: Rec): 'roles' | 'rule' | null {
  const longPoll = isRec(state.interaction) ? state.interaction.longPoll : undefined;
  if (!isRec(longPoll)) return null;
  return longPoll.rule !== undefined && longPoll.rule !== null ? 'rule' : 'roles';
}

export function summarizeChildWorkflow(json: unknown): ChildWorkflowSummary | null {
  if (!isRec(json) || !isRec(json.attributes) || !Array.isArray(json.attributes.states)) return null;
  const attributes = json.attributes;

  const states: ChildStateSummary[] = [];
  const transitions = new Map<string, string[]>();

  const addTransition = (transition: unknown): void => {
    if (!isRec(transition) || typeof transition.key !== 'string' || transition.key === '') return;
    const viewKeys = transitions.get(transition.key) ?? [];
    for (const key of viewKeysOf(transition)) {
      if (!viewKeys.includes(key)) viewKeys.push(key);
    }
    transitions.set(transition.key, viewKeys);
  };

  for (const state of attributes.states as unknown[]) {
    if (!isRec(state) || typeof state.key !== 'string') continue;
    states.push({ key: state.key, longPollAuth: longPollAuthOf(state), viewKeys: viewKeysOf(state) });
    if (Array.isArray(state.transitions)) (state.transitions as unknown[]).forEach(addTransition);
  }
  if (Array.isArray(attributes.sharedTransitions)) (attributes.sharedTransitions as unknown[]).forEach(addTransition);
  for (const lifecycle of ['cancel', 'exit', 'updateData'] as const) addTransition(attributes[lifecycle]);

  return {
    states,
    transitions: [...transitions].map(([key, viewKeys]) => ({ key, viewKeys })),
  };
}
