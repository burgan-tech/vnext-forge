import {
  ERROR_CODES,
  VnextForgeError,
} from '@vnext-forge/app-contracts';
import type { ValidationIssue } from './WorkflowValidationTypes';

type WorkflowStateNode = {
  key: string;
  stateType?: number;
  subFlow?: unknown;
  label?: string;
  labels?: Array<{ label?: string }>;
  onEntries?: unknown[];
  onExits?: unknown[];
  transitions?: WorkflowTransition[];
};

type WorkflowTransition = {
  key: string;
  to?: string;
  triggerType?: number;
  triggerKind?: number;
  rule?: unknown;
  mapping?: unknown;
};

type WorkflowData = {
  attributes?: {
    start?: { to?: string };
    states?: WorkflowStateNode[];
  };
};

let ruleId = 0;

function makeId() {
  ruleId += 1;
  return `v-${ruleId}`;
}

export function validateWorkflow(workflow: unknown): ValidationIssue[] {
  if (!isWorkflowData(workflow)) {
    throw new VnextForgeError(
      ERROR_CODES.WORKFLOW_INVALID,
      'Workflow document must be a JSON object.',
      {
        source: 'workflow-validation/ValidationEngine.validateWorkflow',
        layer: 'feature',
      },
    );
  }

  ruleId = 0;
  const results: ValidationIssue[] = [];
  const states = workflow.attributes?.states ?? [];
  const stateKeys = new Set(states.map((state) => state.key));
  const initialStates = states.filter((state) => state.stateType === 1);
  const finalStates = states.filter((state) => state.stateType === 3);

  if (initialStates.length === 0) {
    results.push({
      id: makeId(),
      severity: 'error',
      message: 'No initial state (stateType=1) defined',
      rule: 'initial-state-required',
    });
  }

  if (finalStates.length === 0) {
    results.push({
      id: makeId(),
      severity: 'error',
      message: 'No final state (stateType=3) defined',
      rule: 'final-state-required',
    });
  }

  const startTarget = workflow.attributes?.start?.to;
  if (!startTarget) {
    results.push({
      id: makeId(),
      severity: 'error',
      message: 'No start transition defined',
      rule: 'start-transition-required',
    });
  } else if (!stateKeys.has(startTarget)) {
    results.push({
      id: makeId(),
      severity: 'error',
      message: `Start transition targets non-existent state "${startTarget}"`,
      rule: 'start-target-valid',
      nodeId: '__start__',
    });
  }

  const seenStateKeys = new Set<string>();
  for (const state of states) {
    if (seenStateKeys.has(state.key)) {
      results.push({
        id: makeId(),
        severity: 'error',
        message: `Duplicate state key "${state.key}"`,
        rule: 'unique-state-key',
        nodeId: state.key,
      });
    }
    seenStateKeys.add(state.key);
  }

  for (const state of states) {
    for (const transition of state.transitions ?? []) {
      if (!transition.to || !stateKeys.has(transition.to)) {
        results.push({
          id: makeId(),
          severity: 'error',
          message: `Transition "${transition.key}" in "${state.key}" targets non-existent state "${transition.to ?? ''}"`,
          rule: 'transition-target-valid',
          nodeId: state.key,
          edgeId: `${state.key}->${transition.to ?? ''}::${transition.key}`,
        });
      }
    }
  }

  for (const state of states) {
    const transitionKeys = new Set<string>();
    for (const transition of state.transitions ?? []) {
      if (transitionKeys.has(transition.key)) {
        results.push({
          id: makeId(),
          severity: 'error',
          message: `Duplicate transition key "${transition.key}" in state "${state.key}"`,
          rule: 'unique-transition-key',
          nodeId: state.key,
        });
      }
      transitionKeys.add(transition.key);
    }
  }

  for (const state of states) {
    const transitions = state.transitions ?? [];
    if (state.stateType === 5 && transitions.length > 1) {
      results.push({
        id: makeId(),
        severity: 'error',
        message: `Wizard state "${state.key}" has ${transitions.length} transitions (max 1)`,
        rule: 'wizard-single-transition',
        nodeId: state.key,
      });
    }
  }

  const reachableStates = new Set<string>();
  if (startTarget) {
    collectReachableStates(startTarget, states, reachableStates);
  }

  for (const state of states) {
    if (!reachableStates.has(state.key) && state.stateType !== 1) {
      results.push({
        id: makeId(),
        severity: 'warning',
        message: `State "${state.key}" is unreachable`,
        rule: 'reachable-state',
        nodeId: state.key,
      });
    }
  }

  for (const state of states) {
    if (state.stateType === 2 && (state.transitions?.length ?? 0) === 0) {
      results.push({
        id: makeId(),
        severity: 'warning',
        message: `Intermediate state "${state.key}" has no outgoing transitions`,
        rule: 'dead-end-state',
        nodeId: state.key,
      });
    }
  }

  for (const state of states) {
    for (const transition of state.transitions ?? []) {
      if (transition.triggerType === 1 && !transition.rule && !transition.mapping) {
        results.push({
          id: makeId(),
          severity: 'warning',
          message: `Auto transition "${transition.key}" in "${state.key}" has no condition rule`,
          rule: 'auto-needs-condition',
          nodeId: state.key,
        });
      }
    }
  }

  if (initialStates.length > 1) {
    results.push({
      id: makeId(),
      severity: 'warning',
      message: `${initialStates.length} initial states found (expected 1)`,
      rule: 'single-initial-state',
    });
  }

  for (const state of states) {
    if (state.stateType === 4 && !state.subFlow) {
      results.push({
        id: makeId(),
        severity: 'warning',
        message: `SubFlow state "${state.key}" has no SubFlow configuration`,
        rule: 'subflow-config-required',
        nodeId: state.key,
      });
    }
  }

  for (const state of states) {
    const autoTransitions = (state.transitions ?? []).filter(
      (transition) => transition.triggerType === 1,
    );

    if (
      autoTransitions.length > 1 &&
      !autoTransitions.some((transition) => transition.triggerKind === 10)
    ) {
      results.push({
        id: makeId(),
        severity: 'warning',
        message: `State "${state.key}" has ${autoTransitions.length} auto transitions but no default (triggerKind=10)`,
        rule: 'default-auto-needed',
        nodeId: state.key,
      });
    }
  }

  for (const state of states) {
    const labels = state.labels ?? [];
    const hasLabels = Boolean(state.label) || labels.some((entry) => Boolean(entry.label));
    if (!hasLabels) {
      results.push({
        id: makeId(),
        severity: 'info',
        message: `State "${state.key}" has no labels`,
        rule: 'missing-labels',
        nodeId: state.key,
      });
    }
  }

  for (const state of states) {
    const hasTasks = (state.onEntries?.length ?? 0) > 0 || (state.onExits?.length ?? 0) > 0;
    if (!hasTasks && state.stateType !== 1 && state.stateType !== 3) {
      results.push({
        id: makeId(),
        severity: 'info',
        message: `State "${state.key}" has no entry/exit tasks`,
        rule: 'empty-tasks',
        nodeId: state.key,
      });
    }
  }

  return results;
}

function isWorkflowData(value: unknown): value is WorkflowData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectReachableStates(
  stateKey: string,
  states: WorkflowStateNode[],
  visited: Set<string>,
) {
  if (visited.has(stateKey)) {
    return;
  }

  visited.add(stateKey);

  const state = states.find((entry) => entry.key === stateKey);
  if (!state) {
    return;
  }

  for (const transition of state.transitions ?? []) {
    if (transition.to) {
      collectReachableStates(transition.to, states, visited);
    }
  }
}
