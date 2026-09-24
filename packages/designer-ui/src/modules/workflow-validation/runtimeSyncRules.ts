import { isHumanTaskGateMissing, type HumanTaskStateLike } from '../canvas-interaction/utils/humanTask';
import { isRec } from '../canvas-interaction/utils/stateNodeData';

/**
 * Workflow rules that come from runtime behaviour rather than the schema
 * (spec Phase C7). Shared by `validateWorkflow` (Problems panel) and
 * `lintWorkflow` (canvas) so the two never disagree.
 */

export type RuntimeSyncSeverity = 'error' | 'warning' | 'info';

export interface RuntimeSyncFinding {
  severity: RuntimeSyncSeverity;
  rule: string;
  message: string;
  stateKey?: string;
}

const TRIGGER_AUTOMATIC = 1;
const TRIGGER_SCHEDULED = 2;

function timerReset(timeout: unknown): string | null {
  if (!isRec(timeout) || !isRec(timeout.timer)) return null;
  const reset = timeout.timer.reset;
  return typeof reset === 'string' && reset.trim() !== '' ? reset : null;
}

export function runtimeSyncFindings(workflow: unknown): RuntimeSyncFinding[] {
  if (!isRec(workflow) || !isRec(workflow.attributes)) return [];
  const attributes = workflow.attributes;
  const findings: RuntimeSyncFinding[] = [];

  const workflowReset = timerReset(attributes.timeout);
  if (workflowReset !== null) {
    findings.push({
      severity: 'info',
      rule: 'timeout-timer-reset-ignored',
      message: `Workflow timeout timer.reset "${workflowReset}" has no effect — the runtime does not implement reset strategies.`,
    });
  }

  const states = Array.isArray(attributes.states) ? (attributes.states as unknown[]).filter(isRec) : [];
  for (const state of states) {
    const key = typeof state.key === 'string' ? state.key : '';
    const subFlow = isRec(state.subFlow) ? state.subFlow : null;

    if (subFlow?.type === 'P') {
      findings.push({
        severity: 'error',
        rule: 'subflow-state-subprocess',
        message: `State "${key}" starts a SubProcess from its subFlow (type "P"). A state may only start a SubFlow — start a SubProcess with a SubProcessTask (type 14).`,
        stateKey: key,
      });
    }

    const overrideReset = subFlow && isRec(subFlow.overrides) ? timerReset(subFlow.overrides.timeout) : null;
    if (overrideReset !== null) {
      findings.push({
        severity: 'info',
        rule: 'timeout-timer-reset-ignored',
        message: `SubFlow timeout override in state "${key}": timer.reset "${overrideReset}" has no effect — the runtime does not implement reset strategies.`,
        stateKey: key,
      });
    }

    if (isHumanTaskGateMissing(state as HumanTaskStateLike, attributes.queryRoles)) {
      findings.push({
        severity: 'warning',
        rule: 'human-task-query-roles',
        message: `Human task state "${key}" has no queryRoles and the workflow declares none. The human-task list fails closed, so this task is listed for nobody, unless a parent subflow overrides queryRoles for this state.`,
        stateKey: key,
      });
    }

    const triggers = (Array.isArray(state.transitions) ? (state.transitions as unknown[]) : [])
      .filter(isRec)
      .map((transition) => transition.triggerType);
    if (triggers.includes(TRIGGER_AUTOMATIC) && triggers.includes(TRIGGER_SCHEDULED)) {
      findings.push({
        severity: 'info',
        rule: 'auto-and-scheduled',
        message: `State "${key}" has both automatic and scheduled transitions. When an automatic transition fires, the scheduled timer is never armed.`,
        stateKey: key,
      });
    }
  }

  return findings;
}
