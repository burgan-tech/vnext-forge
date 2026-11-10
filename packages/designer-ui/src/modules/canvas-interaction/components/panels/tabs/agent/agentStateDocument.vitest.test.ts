import { describe, expect, it } from 'vitest';

import { applyScriptValueToWorkflow } from '../../../../../code-editor/ScriptWorkflowSync';
import type { ActiveScript } from '../../../../../code-editor/ScriptPanelStore';
import {
  applyStateTypeChange,
  renameAgentTransitionRefs,
  updateAgentSection,
} from './agentStateDocument';

type Json = Record<string, any>;

describe('applyStateTypeChange', () => {
  it('seeds the agent block, keeps None/Busy and drops subFlow when a state becomes AI Agent', () => {
    const state: Json = { key: 's', stateType: 4, subType: 6, subFlow: { process: {} } };
    applyStateTypeChange(state, 6, 'core');
    expect(state.stateType).toBe(6);
    expect(state.subType).toBe(5);
    expect(state.subFlow).toBeUndefined();
    expect(state.agent).toMatchObject({
      agent: { domain: 'core', flow: 'sys-agents' },
      prompt: { template: '' },
      output: { path: '$.agent' },
      decision: { mode: 'model', fallback: '' },
    });
  });

  it('keeps an existing agent block and removes it when the state stops being AI Agent', () => {
    const agent = { agent: { key: 'a' }, prompt: { template: 'x' }, output: { path: '$.x' }, decision: { fallback: 'f' } };
    const state: Json = { key: 's', stateType: 2, agent };
    applyStateTypeChange(state, 6);
    expect(state.agent).toBe(agent);
    applyStateTypeChange(state, 2);
    expect(state.agent).toBeUndefined();
  });
});

describe('renameAgentTransitionRefs', () => {
  it('carries a renamed key through reserved exits, exclude and hints', () => {
    const agent: Json = {
      decision: { fallback: 'old', onExhausted: 'old', exclude: ['old', 'x'], hints: { old: 'when', y: 'z' } },
    };
    renameAgentTransitionRefs(agent, 'old', 'new');
    expect(agent.decision).toEqual({
      fallback: 'new',
      onExhausted: 'new',
      exclude: ['new', 'x'],
      hints: { new: 'when', y: 'z' },
    });
  });
});

describe('updateAgentSection', () => {
  it('drops an optional section that ends up empty but keeps required ones', () => {
    const draft: Json = {
      attributes: { states: [{ key: 's', stateType: 6, agent: { tools: { exclude: ['a'] }, prompt: { template: 't' } } }] },
    };
    updateAgentSection(draft, 's', 'tools', (t) => {
      delete t.exclude;
    });
    updateAgentSection(draft, 's', 'prompt', (p) => {
      delete p.template;
    });
    expect(draft.attributes.states[0].agent).toEqual({ prompt: {} });
  });
});

describe('script panel sync for the AI Agent prompt', () => {
  it('merges the C# prompt mapping into the prompt without dropping messages or context', () => {
    const draft: Json = {
      attributes: {
        states: [
          {
            key: 's',
            agent: { prompt: { messages: [{ role: 'user', content: 'hi' }], context: { c: 'data.c' } }, decision: { mapping: null } },
          },
        ],
      },
    };
    const value = { location: './src/P.csx', code: 'Y29kZQ==', encoding: 'B64' as const };
    applyScriptValueToWorkflow(draft, { stateKey: 's', listField: 'agent', scriptField: 'prompt', index: 0 } as ActiveScript, value);
    expect(draft.attributes.states[0].agent.prompt).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
      context: { c: 'data.c' },
      ...value,
    });
    applyScriptValueToWorkflow(
      draft,
      { stateKey: 's', listField: 'agent', scriptField: 'decision.mapping', index: 0 } as ActiveScript,
      value,
    );
    expect(draft.attributes.states[0].agent.decision.mapping).toEqual(value);
  });
});
