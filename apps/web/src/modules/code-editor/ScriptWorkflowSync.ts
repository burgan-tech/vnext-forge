import type { ActiveScript } from './ScriptPanelStore';
import type { ScriptCode } from './CodeEditorTypes';

interface WorkflowDraftState {
  key: string;
  transitions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface WorkflowDraft {
  attributes?: {
    states?: WorkflowDraftState[];
  };
}

export function applyScriptValueToWorkflow(
  draft: WorkflowDraft,
  activeScript: ActiveScript,
  value: ScriptCode,
) {
  const state = draft.attributes?.states?.find((entry) => entry.key === activeScript.stateKey);
  if (!state) return;

  if (activeScript.listField === 'transitions') {
    const transition = state.transitions?.[activeScript.index];
    if (!transition) return;

    transition[activeScript.scriptField] = value;
    if (activeScript.scriptField === 'rule') transition.condition = value;
    if (activeScript.scriptField === 'condition') transition.rule = value;
    return;
  }

  const entries = state[activeScript.listField];
  if (!Array.isArray(entries)) return;

  const entry = entries[activeScript.index] as Record<string, unknown> | undefined;
  if (!entry) return;

  entry[activeScript.scriptField] = value;
}
