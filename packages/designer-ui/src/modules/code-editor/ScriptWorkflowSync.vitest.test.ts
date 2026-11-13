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

describe('applyScriptValueToWorkflow — object holders on a state', () => {
  it('writes the long-poll rule under interaction.longPoll', () => {
    const draft = {
      attributes: {
        states: [
          { key: 'state-a', interaction: { longPoll: { terminate: true, rule: { location: '', code: '' } } } },
        ],
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'interaction', scriptField: 'longPoll.rule' }),
      nextValue,
    );

    expect(draft.attributes.states[0]!.interaction.longPoll.rule).toEqual(nextValue);
  });

  it('writes the subflow timeout override mapping', () => {
    const draft = {
      attributes: {
        states: [{ key: 'state-a', subFlow: { overrides: { timeout: { key: 't', target: 'x' } } } }],
      },
    };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'subFlow', scriptField: 'overrides.timeout.mapping' }),
      nextValue,
    );

    expect((draft.attributes.states[0]!.subFlow.overrides.timeout as Record<string, unknown>).mapping).toEqual(
      nextValue,
    );
  });

  it('writes a flat field on an object holder (subFlow.mapping)', () => {
    const draft = { attributes: { states: [{ key: 'state-a', subFlow: { mapping: { code: 'old' } } }] } };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'subFlow', scriptField: 'mapping' }),
      nextValue,
    );

    expect(draft.attributes.states[0]!.subFlow.mapping).toEqual(nextValue);
  });

  it('is a no-op when an intermediate holder is missing', () => {
    const draft = { attributes: { states: [{ key: 'state-a', subFlow: {} as Record<string, unknown> }] } };

    applyScriptValueToWorkflow(
      draft,
      makeActiveScript({ listField: 'subFlow', scriptField: 'overrides.timeout.mapping' }),
      nextValue,
    );

    expect(draft.attributes.states[0]!.subFlow).toEqual({});
  });
});

describe('applyScriptValueToWorkflow — indexed transition paths', () => {
  const transitionScript = (scriptField: string) =>
    makeActiveScript({ listField: 'transitions', index: 0, scriptField });

  it('writes a rule-based schemas entry rule (schemas[1].rule)', () => {
    const draft = {
      attributes: {
        states: [
          {
            key: 'state-a',
            transitions: [
              { key: 't1', schemas: [{ rule: { code: 'a' }, schema: { key: 's1' } }, { rule: { code: 'b' }, schema: { key: 's2' } }] },
            ],
          },
        ],
      },
    };
    applyScriptValueToWorkflow(draft, transitionScript('schemas[1].rule'), nextValue);
    const schemas = draft.attributes.states[0]!.transitions[0]!.schemas;
    expect(schemas[1]!.rule).toEqual(nextValue);
    expect(schemas[0]!.rule).toEqual({ code: 'a' });
  });

  it('unwraps the { schemas: [...] } wire form', () => {
    const draft = {
      attributes: {
        states: [{ key: 'state-a', transitions: [{ key: 't1', schemas: { schemas: [{ schema: { key: 's1' } }] } }] }],
      },
    };
    applyScriptValueToWorkflow(draft, transitionScript('schemas[0].rule'), nextValue);
    expect(draft.attributes.states[0]!.transitions[0]!.schemas.schemas[0]).toEqual({ schema: { key: 's1' }, rule: nextValue });
  });

  it('writes a view binding rule (views[0].rule)', () => {
    const draft = {
      attributes: { states: [{ key: 'state-a', transitions: [{ key: 't1', views: [{ view: { key: 'v' } }] }] }] },
    };
    applyScriptValueToWorkflow(draft, transitionScript('views[0].rule'), nextValue);
    expect(draft.attributes.states[0]!.transitions[0]!.views[0]).toEqual({ view: { key: 'v' }, rule: nextValue });
  });

  it('writes a state-level view binding rule at its path, not as a "views[1].rule" key', () => {
    const draft = {
      attributes: { states: [{ key: 'state-a', views: [{ view: { key: 'v0' } }, { view: { key: 'v1' } }] as Record<string, unknown>[] }] },
    };
    applyScriptValueToWorkflow(draft, makeActiveScript({ listField: 'views', index: 1, scriptField: 'views[1].rule' }), nextValue);
    expect(draft.attributes.states[0]!.views).toEqual([{ view: { key: 'v0' } }, { view: { key: 'v1' }, rule: nextValue }]);
  });

  it('writes an execution task mapping without replacing the task (onExecutionTasks.0.mapping)', () => {
    const draft = {
      attributes: { states: [{ key: 'state-a', transitions: [{ key: 't1', onExecutionTasks: [{ order: 1, task: { key: 'x' } }] }] }] },
    };
    applyScriptValueToWorkflow(draft, transitionScript('onExecutionTasks.0.mapping'), nextValue);
    expect(draft.attributes.states[0]!.transitions[0]!.onExecutionTasks[0]).toEqual({ order: 1, task: { key: 'x' }, mapping: nextValue });
  });

  it('is a no-op when the indexed entry does not exist', () => {
    const draft = { attributes: { states: [{ key: 'state-a', transitions: [{ key: 't1', schemas: [] as unknown[] }] }] } };
    applyScriptValueToWorkflow(draft, transitionScript('schemas[2].rule'), nextValue);
    expect(draft.attributes.states[0]!.transitions[0]!.schemas).toEqual([]);
  });
});
