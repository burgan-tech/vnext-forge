import { describe, expect, it } from 'vitest';

import type { ActiveScript } from './ScriptPanelStore.js';
import type { ScriptCode } from './CodeEditorTypes.js';
import { applyScriptValueToWorkflow, WORKFLOW_LEVEL_STATE_KEY } from './ScriptWorkflowSync.js';

function makeActiveScript(overrides: Partial<ActiveScript>): ActiveScript {
  return {
    stateKey: 'state-a',
    listField: 'onEntries',
    index: 0,
    scriptField: 'mapping',
    value: { location: '', code: '', encoding: 'B64' },
    templateType: 'mapping',
    label: 'test',
    ...overrides,
  } as ActiveScript;
}

const nextValue: ScriptCode = {
  location: './src/Updated.csx',
  code: 'ZWRpdGVk',
  encoding: 'B64',
};

describe('applyScriptValueToWorkflow', () => {
  it('writes state-level list entry scripts (existing behavior)', () => {
    const draft = {
      attributes: {
        states: [
          { key: 'state-a', onEntries: [{ order: 1, mapping: { code: 'old' } }] },
        ],
      },
    };

    applyScriptValueToWorkflow(draft, makeActiveScript({}), nextValue);

    expect(draft.attributes.states[0]!.onEntries[0]!.mapping).toEqual(nextValue);
  });

  it('writes a workflow-level scriptCode directly on attributes (output)', () => {
    const draft = {
      attributes: {
        states: [],
        output: { location: './src/WorkflowOutputMapping.csx', code: 'b2xk', encoding: 'B64' },
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({
        stateKey: WORKFLOW_LEVEL_STATE_KEY,
        listField: 'attributes',
        scriptField: 'output',
      }),
      nextValue,
    );

    expect(draft.attributes.output).toEqual(nextValue);
  });

  it('writes a workflow-level nested scriptCode holder (timeout.mapping)', () => {
    const draft = {
      attributes: {
        states: [],
        timeout: { key: 'timeout', mapping: { code: 'old' } },
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({
        stateKey: WORKFLOW_LEVEL_STATE_KEY,
        listField: 'timeout',
        scriptField: 'mapping',
      }),
      nextValue,
    );

    expect(draft.attributes.timeout.mapping).toEqual(nextValue);
  });

  it('is a no-op when the workflow-level holder is missing', () => {
    const draft: { attributes: Record<string, unknown> } = { attributes: { states: [] } };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({
        stateKey: WORKFLOW_LEVEL_STATE_KEY,
        listField: 'timeout',
        scriptField: 'mapping',
      }),
      nextValue,
    );

    expect(draft.attributes.timeout).toBeUndefined();
  });

  it('writes a transition-level nested scriptCode holder (event.mapping)', () => {
    const draft = {
      attributes: {
        states: [
          {
            key: 'state-a',
            transitions: [{ key: 't1', event: { mapping: { code: 'old' } } }],
          },
        ],
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({
        listField: 'transitions',
        index: 0,
        scriptField: 'event.mapping',
      }),
      nextValue,
    );

    expect(draft.attributes.states[0]!.transitions[0]!.event.mapping).toEqual(nextValue);
  });

  it('is a no-op when the transition-level nested holder is missing', () => {
    const draft = {
      attributes: {
        states: [
          { key: 'state-a', transitions: [{ key: 't1' }] },
        ],
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({
        listField: 'transitions',
        index: 0,
        scriptField: 'event.mapping',
      }),
      nextValue,
    );

    expect((draft.attributes.states[0]!.transitions[0] as { event?: unknown }).event).toBeUndefined();
  });

  it('is a no-op for unknown state keys', () => {
    const draft = { attributes: { states: [{ key: 'other', onEntries: [] }] } };

    applyScriptValueToWorkflow(draft, makeActiveScript({}), nextValue);

    expect(draft.attributes.states[0]).toEqual({ key: 'other', onEntries: [] });
  });
});
