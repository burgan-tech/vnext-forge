import type { ExecutionType } from '@vnext-forge-studio/vnext-types';

/**
 * Definition-declared execution modes (runtime 0.0.99): `transition.executionType
 * ?? flow.attributes.executionType ?? ?sync`. The state function does not
 * expose them, so Quick Run reads them from the local workflow file.
 */
export interface FlowExecutionTypes {
  flow?: ExecutionType;
  start?: ExecutionType;
  /** By transition key (state, shared); the last declaration wins on a clash. */
  transitions: Record<string, ExecutionType>;
  /** By `<state>/<transition>` for state transitions. */
  stateTransitions: Record<string, ExecutionType>;
}

export interface EffectiveExecutionMode {
  sync: boolean;
  source: 'transition' | 'flow';
}

interface Keyed {
  key?: unknown;
  executionType?: unknown;
}

function asExecutionType(v: unknown): ExecutionType | undefined {
  return v === 'S' || v === 'A' ? v : undefined;
}

export function extractExecutionTypes(flowJson: unknown): FlowExecutionTypes {
  const attrs = (flowJson as { attributes?: Record<string, unknown> } | null)?.attributes ?? {};
  const out: FlowExecutionTypes = { transitions: {}, stateTransitions: {} };
  const flow = asExecutionType(attrs.executionType);
  if (flow) out.flow = flow;
  const start = asExecutionType((attrs.startTransition as Keyed | undefined)?.executionType);
  if (start) out.start = start;

  const states = Array.isArray(attrs.states) ? (attrs.states as Array<Keyed & { transitions?: unknown }>) : [];
  for (const state of states) {
    const transitions = Array.isArray(state.transitions) ? (state.transitions as Keyed[]) : [];
    for (const t of transitions) {
      const type = asExecutionType(t.executionType);
      if (!type || typeof t.key !== 'string') continue;
      out.transitions[t.key] = type;
      if (typeof state.key === 'string') out.stateTransitions[`${state.key}/${t.key}`] = type;
    }
  }
  const shared = Array.isArray(attrs.sharedTransitions) ? (attrs.sharedTransitions as Keyed[]) : [];
  for (const t of shared) {
    const type = asExecutionType(t.executionType);
    if (type && typeof t.key === 'string') out.transitions[t.key] = type;
  }
  return out;
}

/**
 * The mode the runtime will use regardless of `?sync=`, or null when the
 * definition leaves it to the caller. `transitionKey === null` means the
 * start transition. Automatic transitions ignore the field, but Quick Run
 * only fires manual ones.
 */
export function resolveEffectiveExecutionMode(
  types: FlowExecutionTypes | null | undefined,
  transitionKey: string | null,
  fromState?: string,
): EffectiveExecutionMode | null {
  if (!types) return null;
  const own =
    transitionKey === null
      ? types.start
      : ((fromState ? types.stateTransitions[`${fromState}/${transitionKey}`] : undefined) ??
        types.transitions[transitionKey]);
  if (own) return { sync: own === 'S', source: 'transition' };
  if (types.flow) return { sync: types.flow === 'S', source: 'flow' };
  return null;
}

export function executionModeNote(mode: EffectiveExecutionMode): string {
  const what = mode.sync ? 'Sync' : 'Async';
  return mode.source === 'transition'
    ? `Defined by the transition: ${what} (executionType overrides ?sync).`
    : `Defined by the flow: ${what} (executionType overrides ?sync).`;
}
