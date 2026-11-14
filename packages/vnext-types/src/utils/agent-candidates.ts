import { StateType } from '../constants/state-types';
import { TriggerKind, TriggerType } from '../constants/trigger-types';

/**
 * AI Agent decision candidates and the publish checks of an AiAgent state
 * (runtime 0.0.105, vnext#1105). Mirrors the runtime's `AgentCandidateSet`
 * and `WorkflowValidator.ValidateAiAgentStates`; keep them in sync.
 */

/** Where a candidate's "when" text came from — the runtime's `whenSource` values. */
export type AgentCandidateWhenSource = 'hintsMapping' | 'hint' | 'description' | 'label' | 'key';

export interface AgentCandidate {
  key: string;
  when: string;
  whenSource: AgentCandidateWhenSource;
  target?: string;
}

export type AgentReservedExitRole = 'fallback' | 'onApprovalRequest' | 'onExhausted';

export interface AgentCandidateSet {
  /** Rule-less automatic transitions minus reserved exits and `decision.exclude`, in evaluation order. */
  candidates: AgentCandidate[];
  /** Reserved exits that exist on the state (fallback first). */
  reserved: { role: AgentReservedExitRole; key: string; target?: string }[];
  /** Automatic transitions that keep their own rule (mixed mode). */
  ruled: string[];
  /** Rule-less automatic transitions left out through `decision.exclude`. */
  excluded: string[];
}

export const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const AGENT_CONTEXT_ROOTS = ['data.', 'body.', 'instance.'];
const PROMPT_ROLES = new Set(['system', 'user', 'assistant']);

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function transitionsOf(state: Json): Json[] {
  return Array.isArray(state.transitions) ? state.transitions.filter(isRecord) : [];
}

function firstLabel(transition: Json): string | undefined {
  const labels = Array.isArray(transition.labels) ? transition.labels : Array.isArray(transition.label) ? transition.label : [];
  for (const entry of labels) {
    if (isRecord(entry) && str(entry.label)) return String(entry.label);
  }
  return undefined;
}

function decisionOf(state: Json): Json | undefined {
  const agent = isRecord(state.agent) ? state.agent : undefined;
  return agent && isRecord(agent.decision) ? agent.decision : undefined;
}

/** The decision's reserved exit keys (fallback, onApprovalRequest, onExhausted), skipping blanks. */
export function agentReservedExitKeys(decision: Json | undefined): { role: AgentReservedExitRole; key: string }[] {
  if (!decision) return [];
  const out: { role: AgentReservedExitRole; key: string }[] = [];
  for (const role of ['fallback', 'onApprovalRequest', 'onExhausted'] as const) {
    const key = str(decision[role]);
    if (key) out.push({ role, key });
  }
  return out;
}

/** True for an automatic transition the runtime lets the agent decide (no rule). */
export function isAgentDecidedTransition(transition: Json): boolean {
  return transition.triggerType === TriggerType.Automatic && transition.rule == null;
}

/**
 * Resolves the candidate set of an AiAgent state the way the runtime does,
 * with each candidate's "when" text (hints → description → first label → key;
 * a `hintsMapping` result is only known at run time).
 */
export function resolveAgentCandidates(state: unknown): AgentCandidateSet {
  const empty: AgentCandidateSet = { candidates: [], reserved: [], ruled: [], excluded: [] };
  if (!isRecord(state)) return empty;
  const decision = decisionOf(state);
  const transitions = transitionsOf(state);
  const auto = transitions.filter((t) => t.triggerType === TriggerType.Automatic);
  const reservedKeys = agentReservedExitKeys(decision);
  const reservedSet = new Set(reservedKeys.map((r) => r.key));
  const exclude = new Set(
    Array.isArray(decision?.exclude) ? decision.exclude.filter((k): k is string => typeof k === 'string') : [],
  );
  const hints = isRecord(decision?.hints) ? decision.hints : {};

  const result: AgentCandidateSet = {
    candidates: [],
    reserved: reservedKeys.map((r) => ({
      ...r,
      target: str(auto.find((t) => t.key === r.key)?.target) ?? str(transitions.find((t) => t.key === r.key)?.target),
    })),
    ruled: [],
    excluded: [],
  };

  for (const t of auto) {
    const key = str(t.key);
    if (!key) continue;
    if (t.rule != null) {
      result.ruled.push(key);
      continue;
    }
    if (t.triggerKind === TriggerKind.DefaultAuto || reservedSet.has(key)) continue;
    if (exclude.has(key)) {
      result.excluded.push(key);
      continue;
    }
    const hint = str(hints[key]);
    const description = str(t.description);
    const label = firstLabel(t);
    const [when, whenSource]: [string, AgentCandidateWhenSource] = hint
      ? [hint, 'hint']
      : description
        ? [description, 'description']
        : label
          ? [label, 'label']
          : [key, 'key'];
    result.candidates.push({ key, when, whenSource, target: str(t.target) });
  }
  return result;
}

export interface AiAgentStateIssue {
  severity: 'error' | 'warning';
  stateKey: string;
  /** Dotted path under the state, e.g. `agent.decision.fallback`. */
  path: string;
  message: string;
}

/**
 * Publish checks of AiAgent states (and stray `agent` blocks on other states)
 * for a workflow's `attributes.states`.
 */
export function validateAiAgentStates(states: unknown): AiAgentStateIssue[] {
  const issues: AiAgentStateIssue[] = [];
  if (!Array.isArray(states)) return issues;
  for (const state of states) {
    if (!isRecord(state)) continue;
    const stateKey = typeof state.key === 'string' ? state.key : '';
    const add = (path: string, message: string, severity: 'error' | 'warning' = 'error') =>
      issues.push({ severity, stateKey, path, message });

    if (state.stateType !== StateType.AiAgent) {
      if (state.agent != null) {
        add('agent', `State "${stateKey}" declares an agent block but its state type is not AI Agent (6).`);
      }
      continue;
    }
    const binding = isRecord(state.agent) ? state.agent : undefined;
    if (!binding) {
      add('agent', `AI Agent state "${stateKey}" must declare an agent block.`);
      continue;
    }
    if (!isRecord(binding.agent) || !str(binding.agent.key)) {
      add('agent.agent', `AI Agent state "${stateKey}" must reference a sys-agents component.`);
    }
    const prompt = isRecord(binding.prompt) ? binding.prompt : undefined;
    if (!prompt || (!str(prompt.template) && !str(prompt.code))) {
      add('agent.prompt', `AI Agent state "${stateKey}" must declare a prompt (template or mapping).`);
    }
    const messages = Array.isArray(prompt?.messages) ? prompt.messages : [];
    messages.forEach((m, i) => {
      const msg = isRecord(m) ? m : {};
      if (typeof msg.role !== 'string' || !PROMPT_ROLES.has(msg.role)) {
        add(`agent.prompt.messages[${i}].role`, `AI Agent state "${stateKey}": prompt message ${i + 1} role must be system, user or assistant.`);
      }
      if (!str(msg.content)) {
        add(`agent.prompt.messages[${i}].content`, `AI Agent state "${stateKey}": prompt message ${i + 1} content is required.`);
      }
    });
    const context = isRecord(prompt?.context) ? prompt.context : {};
    for (const [name, path] of Object.entries(context)) {
      if (!AGENT_NAME_PATTERN.test(name)) {
        add(`agent.prompt.context.${name}`, `AI Agent state "${stateKey}": context name "${name}" must match ^[a-zA-Z0-9_-]{1,64}$.`);
      }
      if (typeof path !== 'string' || !AGENT_CONTEXT_ROOTS.some((root) => path.trim().startsWith(root))) {
        add(`agent.prompt.context.${name}`, `AI Agent state "${stateKey}": context "${name}" must be a data., body. or instance. path.`);
      }
    }
    const outputPath = isRecord(binding.output) ? binding.output.path : undefined;
    if (typeof outputPath !== 'string' || !outputPath.startsWith('$.')) {
      add('agent.output.path', `AI Agent state "${stateKey}" must declare output.path as a "$." JSON path.`);
    }
    const mode = str(binding.mode) ?? 'single';
    const participants = Array.isArray(binding.agents) ? binding.agents : [];
    if (mode === 'single' && participants.length > 0) {
      add('agent.agents', `AI Agent state "${stateKey}" declares participants but mode is single; set mode to sequential, concurrent or handoff.`);
    }
    if (mode !== 'single' && participants.length === 0) {
      add('agent.agents', `AI Agent state "${stateKey}" in mode ${mode} needs at least one participant.`);
    }
    const names = new Set<string>();
    participants.forEach((p, i) => {
      const part = isRecord(p) ? p : {};
      const name = typeof part.name === 'string' ? part.name : '';
      if (!AGENT_NAME_PATTERN.test(name)) {
        add(`agent.agents[${i}].name`, `AI Agent state "${stateKey}": participant ${i + 1} name must match ^[a-zA-Z0-9_-]{1,64}$.`);
      } else if (names.has(name)) {
        add(`agent.agents[${i}].name`, `AI Agent state "${stateKey}": participant name "${name}" is used more than once.`);
      } else {
        names.add(name);
      }
      if (!isRecord(part.agent)) {
        add(`agent.agents[${i}].agent`, `AI Agent state "${stateKey}": participant ${i + 1} must reference a sys-agents component.`);
      }
    });
    const subType = typeof state.subType === 'number' ? state.subType : 0;
    if (subType !== 0 && subType !== 5) {
      add('subType', `AI Agent state "${stateKey}" sub type must be None or Busy.`);
    }
    if (state.subFlow != null) {
      add('subFlow', `AI Agent state "${stateKey}" cannot declare a subFlow.`);
    }
    const decision = isRecord(binding.decision) ? binding.decision : undefined;
    if (!decision) {
      add('agent.decision', `AI Agent state "${stateKey}" must declare a decision.`);
      continue;
    }
    if (!str(decision.fallback)) {
      add('agent.decision.fallback', `AI Agent state "${stateKey}" must declare decision.fallback.`);
    }
    const transitions = transitionsOf(state);
    for (const { role, key } of agentReservedExitKeys(decision)) {
      const t = transitions.find((x) => x.key === key);
      if (t?.triggerType !== TriggerType.Automatic) {
        add(`agent.decision.${role}`, `AI Agent state "${stateKey}": decision.${role} "${key}" must be an automatic transition of the state.`);
      } else if (t.rule != null) {
        add(`agent.decision.${role}`, `AI Agent state "${stateKey}": decision.${role} "${key}" cannot carry a rule; the agent decides it.`);
      }
    }
    for (const t of transitions) {
      if (t.triggerKind === TriggerKind.DefaultAuto && t.key !== decision.fallback) {
        add(
          `transitions.${String(t.key)}`,
          `AI Agent state "${stateKey}": default auto transition "${String(t.key)}" would fire whenever the agent has not decided; only decision.fallback may be one.`,
        );
      }
    }
    const set = resolveAgentCandidates(state);
    const candidateKeys = new Set(set.candidates.map((c) => c.key));
    const decisionMode = str(decision.mode) ?? 'model';
    if (decisionMode === 'model' && candidateKeys.size < 2) {
      add(
        'agent.decision.mode',
        `AI Agent state "${stateKey}" in decision mode "model" needs at least two rule-less automatic transitions besides its reserved exits (found ${candidateKeys.size}); use mode "rules" instead.`,
      );
    }
    if (decisionMode === 'script' && decision.mapping == null) {
      add('agent.decision.mapping', `AI Agent state "${stateKey}" in decision mode "script" must declare decision.mapping.`);
    }
    if (decisionMode === 'rules' && candidateKeys.size > 0) {
      add(
        'transitions',
        `AI Agent state "${stateKey}" in decision mode "rules": automatic transitions ${[...candidateKeys].join(', ')} have no rule; give each a rule or exclude it.`,
      );
    }
    for (const hint of Object.keys(isRecord(decision.hints) ? decision.hints : {})) {
      if (!candidateKeys.has(hint)) {
        add(`agent.decision.hints.${hint}`, `AI Agent state "${stateKey}": hint "${hint}" is not a candidate transition.`);
      }
    }
  }
  return issues;
}
