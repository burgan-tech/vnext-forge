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
    [key: string]: unknown;
  };
}

/**
 * Sentinel `stateKey` for script slots that live on the workflow itself
 * rather than inside a state (e.g. `attributes.output`, `attributes.timeout.mapping`).
 */
export const WORKFLOW_LEVEL_STATE_KEY = '__workflow__';

export function applyScriptValueToWorkflow(
  draft: WorkflowDraft,
  activeScript: ActiveScript,
  value: ScriptCode,
) {
  if (activeScript.stateKey === WORKFLOW_LEVEL_STATE_KEY) {
    const attrs = draft.attributes;
    if (!attrs) return;

    // `listField: 'attributes'` addresses a scriptCode directly on
    // `attributes` (e.g. output); any other listField addresses a nested
    // holder object (e.g. timeout → attributes.timeout.mapping).
    const holder =
      activeScript.listField === 'attributes'
        ? attrs
        : (attrs[activeScript.listField] as Record<string, unknown> | undefined);
    if (!holder || typeof holder !== 'object') return;

    holder[activeScript.scriptField] = value;
    return;
  }

  const state = draft.attributes?.states?.find((entry) => entry.key === activeScript.stateKey);
  if (!state) return;

  if (activeScript.listField === 'transitions') {
    const transition = state.transitions?.[activeScript.index];
    if (!transition) return;

    // A dotted `scriptField` (e.g. `event.mapping`) addresses a nested
    // holder object on the transition rather than a flat property. The
    // holder (e.g. `transition.event`) is expected to already exist —
    // it is created by the corresponding mutation (`updateTransitionEvent`)
    // when the script is first authored, before the panel ever opens.
    if (activeScript.scriptField.includes('.')) {
      const [holderKey, fieldKey] = activeScript.scriptField.split('.');
      const holder = transition[holderKey] as Record<string, unknown> | undefined;
      if (!holder || typeof holder !== 'object') return;
      holder[fieldKey] = value;
      return;
    }

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
