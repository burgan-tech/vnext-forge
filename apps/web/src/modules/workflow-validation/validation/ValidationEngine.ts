export type Severity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  id: string;
  severity: Severity;
  message: string;
  path?: string;
  nodeId?: string;
  edgeId?: string;
  rule: string;
}

interface WorkflowData {
  key: string;
  attributes?: {
    start?: { key: string; to: string };
    states?: any[];
    sharedTransitions?: any[];
    timeout?: any;
    cancel?: any;
  };
}

let ruleId = 0;
function makeId() { return `v-${++ruleId}`; }

export function validateWorkflow(workflow: WorkflowData): ValidationResult[] {
  ruleId = 0;
  const results: ValidationResult[] = [];
  const states = workflow.attributes?.states || [];
  const stateKeys = new Set(states.map((s: any) => s.key));

  // --- CRITICAL ERRORS ---

  // E1: Initial state must exist
  const initialStates = states.filter((s: any) => s.stateType === 1);
  if (initialStates.length === 0) {
    results.push({ id: makeId(), severity: 'error', message: 'No initial state (stateType=1) defined', rule: 'initial-state-required' });
  }

  // E2: Final state must exist
  const finalStates = states.filter((s: any) => s.stateType === 3);
  if (finalStates.length === 0) {
    results.push({ id: makeId(), severity: 'error', message: 'No final state (stateType=3) defined', rule: 'final-state-required' });
  }

  // E3: Start transition must point to valid state
  if (workflow.attributes?.start) {
    const target = workflow.attributes.start.to;
    if (!stateKeys.has(target)) {
      results.push({ id: makeId(), severity: 'error', message: `Start transition targets non-existent state "${target}"`, rule: 'start-target-valid', nodeId: '__start__' });
    }
  } else {
    results.push({ id: makeId(), severity: 'error', message: 'No start transition defined', rule: 'start-transition-required' });
  }

  // E4: Duplicate state keys
  const seenKeys = new Set<string>();
  for (const state of states) {
    if (seenKeys.has(state.key)) {
      results.push({ id: makeId(), severity: 'error', message: `Duplicate state key "${state.key}"`, rule: 'unique-state-key', nodeId: state.key });
    }
    seenKeys.add(state.key);
  }

  // E5: Transition targets must exist
  for (const state of states) {
    for (const t of (state.transitions || [])) {
      if (!stateKeys.has(t.to)) {
        results.push({
          id: makeId(), severity: 'error',
          message: `Transition "${t.key}" in "${state.key}" targets non-existent state "${t.to}"`,
          rule: 'transition-target-valid', nodeId: state.key, edgeId: `${state.key}->${t.to}::${t.key}`,
        });
      }
    }
  }

  // E6: Duplicate transition keys within a state
  for (const state of states) {
    const tKeys = new Set<string>();
    for (const t of (state.transitions || [])) {
      if (tKeys.has(t.key)) {
        results.push({ id: makeId(), severity: 'error', message: `Duplicate transition key "${t.key}" in state "${state.key}"`, rule: 'unique-transition-key', nodeId: state.key });
      }
      tKeys.add(t.key);
    }
  }

  // E7: Wizard state must have at most 1 transition
  for (const state of states) {
    if (state.stateType === 5 && (state.transitions || []).length > 1) {
      results.push({ id: makeId(), severity: 'error', message: `Wizard state "${state.key}" has ${state.transitions.length} transitions (max 1)`, rule: 'wizard-single-transition', nodeId: state.key });
    }
  }

  // --- WARNINGS ---

  // W1: Unreachable states
  const reachable = new Set<string>();
  if (workflow.attributes?.start) {
    collectReachable(workflow.attributes.start.to, states, reachable);
  }
  for (const state of states) {
    if (!reachable.has(state.key) && state.stateType !== 1) {
      results.push({ id: makeId(), severity: 'warning', message: `State "${state.key}" is unreachable`, rule: 'reachable-state', nodeId: state.key });
    }
  }

  // W2: Intermediate state without transitions (dead end)
  for (const state of states) {
    if (state.stateType === 2 && (!state.transitions || state.transitions.length === 0)) {
      results.push({ id: makeId(), severity: 'warning', message: `Intermediate state "${state.key}" has no outgoing transitions`, rule: 'dead-end-state', nodeId: state.key });
    }
  }

  // W3: Auto transition without condition
  for (const state of states) {
    for (const t of (state.transitions || [])) {
      if (t.triggerType === 1 && !t.rule && !t.mapping) {
        results.push({ id: makeId(), severity: 'warning', message: `Auto transition "${t.key}" in "${state.key}" has no condition rule`, rule: 'auto-needs-condition', nodeId: state.key });
      }
    }
  }

  // W4: Multiple initial states
  if (initialStates.length > 1) {
    results.push({ id: makeId(), severity: 'warning', message: `${initialStates.length} initial states found (expected 1)`, rule: 'single-initial-state' });
  }

  // W5: SubFlow state without SubFlow config
  for (const state of states) {
    if (state.stateType === 4 && !state.subFlow) {
      results.push({ id: makeId(), severity: 'warning', message: `SubFlow state "${state.key}" has no SubFlow configuration`, rule: 'subflow-config-required', nodeId: state.key });
    }
  }

  // W6: Multiple auto transitions without default
  for (const state of states) {
    const autoTransitions = (state.transitions || []).filter((t: any) => t.triggerType === 1);
    if (autoTransitions.length > 1) {
      const hasDefault = autoTransitions.some((t: any) => t.triggerKind === 10);
      if (!hasDefault) {
        results.push({ id: makeId(), severity: 'warning', message: `State "${state.key}" has ${autoTransitions.length} auto transitions but no default (triggerKind=10)`, rule: 'default-auto-needed', nodeId: state.key });
      }
    }
  }

  // --- INFO ---

  // I1: States without labels
  for (const state of states) {
    if (!state.label || state.label.length === 0) {
      results.push({ id: makeId(), severity: 'info', message: `State "${state.key}" has no labels`, rule: 'missing-labels', nodeId: state.key });
    }
  }

  // I2: Empty onEntries/onExits
  for (const state of states) {
    if ((!state.onEntries || state.onEntries.length === 0) && (!state.onExits || state.onExits.length === 0) && state.stateType !== 1 && state.stateType !== 3) {
      results.push({ id: makeId(), severity: 'info', message: `State "${state.key}" has no entry/exit tasks`, rule: 'empty-tasks', nodeId: state.key });
    }
  }

  return results;
}

function collectReachable(stateKey: string, states: any[], visited: Set<string>) {
  if (visited.has(stateKey)) return;
  visited.add(stateKey);
  const state = states.find((s: any) => s.key === stateKey);
  if (!state) return;
  for (const t of (state.transitions || [])) {
    collectReachable(t.to, states, visited);
  }
}
