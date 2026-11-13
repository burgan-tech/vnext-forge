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
    // Bracketed segments (e.g. `schemas[1].rule`, `views[0].rule`) index into
    // an entry array; a wrapped `{ schemas: [...] }` holder is unwrapped.
    if (activeScript.scriptField.includes('.')) {
      setAtDottedPath(transition, activeScript.scriptField, value);
      return;
    }

    transition[activeScript.scriptField] = value;
    if (activeScript.scriptField === 'rule') transition.condition = value;
    if (activeScript.scriptField === 'condition') transition.rule = value;
    return;
  }

  // A `scriptField` that indexes the holder itself (state `views`:
  // `views[0].rule`) is a path from the state, not a key on the entry.
  if (activeScript.scriptField.startsWith(`${activeScript.listField}[`)) {
    setAtDottedPath(state, activeScript.scriptField, value);
    return;
  }

  const holder = state[activeScript.listField];

  if (Array.isArray(holder)) {
    const entry = holder[activeScript.index] as Record<string, unknown> | undefined;
    if (!entry) return;
    entry[activeScript.scriptField] = value;
    return;
  }

  // Object holders on a state (`interaction`, `subFlow`): `scriptField` is a
  // dotted path inside the holder, e.g. `longPoll.rule` or
  // `overrides.timeout.mapping`. Intermediate objects must already exist —
  // the owning editor creates them before the script panel opens.
  if (holder && typeof holder === 'object') {
    setAtDottedPath(holder as Record<string, unknown>, activeScript.scriptField, value);
  }
}

const INDEXED_SEGMENT = /^([^[\]]+)\[(\d+)\]$/;

/**
 * Writes `value` at a dotted path. A segment may index an array
 * (`schemas[1]`); when the holder is a `{ <name>: [...] }` wrapper instead
 * of an array (rule-based `views` / `schemas` wire form) the inner array is
 * used. Every intermediate object must already exist.
 */
function setAtDottedPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = root;
  for (const segment of segments.slice(0, -1)) {
    const indexed = INDEXED_SEGMENT.exec(segment);
    let next: unknown;
    if (indexed) {
      const [, name, rawIndex] = indexed;
      let list = cursor[name];
      if (list && typeof list === 'object' && !Array.isArray(list)) {
        list = (list as Record<string, unknown>)[name];
      }
      next = Array.isArray(list) ? list[Number(rawIndex)] : undefined;
    } else {
      next = cursor[segment];
    }
    // Arrays are valid intermediates: a numeric segment indexes them
    // (`onExecutionTasks.0.mapping`).
    if (!next || typeof next !== 'object') return;
    cursor = next as Record<string, unknown>;
  }
  if (Array.isArray(cursor)) return;
  cursor[segments[segments.length - 1]] = value;
}
