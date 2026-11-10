import { StateType, SYS_AGENTS_FLOW } from '@vnext-forge-studio/vnext-types';

/**
 * Draft mutators for an AI Agent state (`stateType: 6`) inside a workflow
 * JSON. Each one edits the member it names and keeps every other member,
 * including ones Forge does not model.
 */

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
}

/** Sets `target[key]`, or deletes it when the value is blank. */
export function setOrDelete(target: Json, key: string, value: unknown): void {
  if (isBlank(value)) delete target[key];
  else target[key] = value;
}

export function findDraftState(draft: Json, stateKey: string): Json | undefined {
  const attrs = isRecord(draft.attributes) ? draft.attributes : undefined;
  const states = Array.isArray(attrs?.states) ? (attrs.states as unknown[]) : [];
  return states.find((s): s is Json => isRecord(s) && s.key === stateKey);
}

/** The `agent` block a new AI Agent state starts with. */
export function defaultAgentBinding(domain = ''): Json {
  return {
    agent: { key: '', domain, flow: SYS_AGENTS_FLOW, version: '1.0.0' },
    prompt: { template: '' },
    output: { path: '$.agent' },
    decision: { mode: 'model', fallback: '' },
  };
}

/**
 * Runs `fn` on the state's `agent` block (created when missing). Use it as the
 * body of `updateWorkflow((draft) => …)`.
 */
export function updateAgentBinding(draft: Json, stateKey: string, fn: (agent: Json, state: Json) => void): void {
  const state = findDraftState(draft, stateKey);
  if (!state) return;
  if (!isRecord(state.agent)) state.agent = defaultAgentBinding();
  fn(state.agent as Json, state);
}

/** Runs `fn` on a sub-object of the agent block (`prompt`, `decision`, `memory`, `policy`, `tools`), dropping it when it ends up empty. */
export function updateAgentSection(
  draft: Json,
  stateKey: string,
  section: 'prompt' | 'decision' | 'memory' | 'policy' | 'tools' | 'output',
  fn: (section: Json) => void,
): void {
  updateAgentBinding(draft, stateKey, (agent) => {
    const current = isRecord(agent[section]) ? (agent[section]) : {};
    fn(current);
    // prompt / output / decision are required by the schema: keep them even when empty.
    if (section === 'prompt' || section === 'output' || section === 'decision') agent[section] = current;
    else setOrDelete(agent, section, current);
  });
}

/**
 * Applies a state-type change. Entering AI Agent seeds the `agent` block,
 * clears a sub type the runtime rejects (only None or Busy) and drops
 * `subFlow`; leaving it removes the `agent` block (the schema forbids it on
 * other state types).
 */
export function applyStateTypeChange(state: Json, nextType: number, domain = ''): void {
  const previous = state.stateType;
  state.stateType = nextType;
  const aiAgent: number = StateType.AiAgent;
  if (nextType === aiAgent) {
    if (!isRecord(state.agent)) state.agent = defaultAgentBinding(domain);
    const subType = typeof state.subType === 'number' ? state.subType : 0;
    if (subType !== 0 && subType !== 5) state.subType = 5;
    delete state.subFlow;
  } else if (previous === aiAgent) {
    delete state.agent;
  }
}

/** Renames a transition key inside the agent block (reserved exits, hints, exclude). */
export function renameAgentTransitionRefs(agent: Json, oldKey: string, newKey: string): void {
  const decision = isRecord(agent.decision) ? agent.decision : undefined;
  if (!decision) return;
  for (const role of ['fallback', 'onApprovalRequest', 'onExhausted']) {
    if (decision[role] === oldKey) decision[role] = newKey;
  }
  if (Array.isArray(decision.exclude)) {
    decision.exclude = (decision.exclude as unknown[]).map((k): unknown => (k === oldKey ? newKey : k));
  }
  if (isRecord(decision.hints) && oldKey in decision.hints) {
    const hints: Json = {};
    for (const [k, v] of Object.entries(decision.hints)) hints[k === oldKey ? newKey : k] = v;
    decision.hints = hints;
  }
}
