import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AgentEditorPanel } from './components/AgentEditorPanel';
import { checkJsonObjectText } from './components/JsonObjectCodeField';
import { instructionsFileRef, sameInstructionsText, setInstructionsCode } from './agentInstructionsFile';
import { AgentStateTab } from '../canvas-interaction/components/panels/tabs/agent/AgentStateTab';

const FIXTURES = join(__dirname, '__fixtures__', 'ai-agent-lab');
type Workflow = { attributes: { states: { stateType: number }[] } } & Record<string, unknown>;
const read = (dir: string, name: string) => JSON.parse(readFileSync(join(FIXTURES, dir, name), 'utf8')) as Workflow;

describe('AgentEditorPanel', () => {
  it('renders an example agent with its provider, tools and approval flag without editing it', () => {
    const json = read('agents', 'ai-approval-agent.json');
    const onChange = vi.fn();
    const html = renderToStaticMarkup(createElement(AgentEditorPanel, { json, onChange }));
    expect(html).toContain('Provider profile');
    expect(html).toContain('local');
    expect(html).toContain('pay');
    expect(html).toContain('lookup');
    expect(html).toContain('Requires approval');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('AgentStateTab', () => {
  it('renders the agent block of an example state with its candidate set and reserved exits', () => {
    const workflow = read('workflows', 'ai-agent-lab.json');
    const state = workflow.attributes.states.find((s) => s.stateType === 6) as unknown as Record<string, unknown> & { key: string };
    const html = renderToStaticMarkup(createElement(AgentStateTab, { state }));
    expect(html).toContain('ai-triage-agent@1.0.0');
    expect(html).toContain('Candidate set (2)');
    expect(html).toContain('is-question');
    expect(html).toContain('is-fraud');
    expect(html).toContain('onExhausted');
    expect(html).toContain('$.triage');
  });

  it('renders a team state with its participants', () => {
    const workflow = read('workflows', 'ai-agent-lab-handoff.json');
    const state = workflow.attributes.states.find((s) => s.stateType === 6) as unknown as Record<string, unknown> & { key: string };
    const html = renderToStaticMarkup(createElement(AgentStateTab, { state }));
    expect(html).toContain('ai-cards-agent@1.0.0');
    expect(html).toContain('ai-loans-agent@1.0.0');
    expect(html).toContain('Card issues.');
  });
});

describe('checkJsonObjectText', () => {
  it('accepts an object schema and reports where JSON breaks', () => {
    expect(checkJsonObjectText('{"type":"object","properties":{}}', true)).toEqual({
      value: { type: 'object', properties: {} },
      error: null,
    });
    expect(checkJsonObjectText('{\n  "type": "object",\n  oops\n}', true).error).toMatch(/^Invalid JSON/);
    expect(checkJsonObjectText('[]').error).toBe('Must be a JSON object.');
    expect(checkJsonObjectText('{"type":"string"}', true).error).toContain('"type": "object"');
    expect(checkJsonObjectText('{"type":"object","required":[1]}', true).error).toContain('"required"');
    expect(checkJsonObjectText('   ')).toEqual({ error: null });
  });
});

describe('file-backed instructions', () => {
  const agent = {
    attributes: { instructions: { location: './instructions.md', code: btoa('Be brief.'), encoding: 'B64' } },
  };

  it('resolves the file next to the agent JSON and decodes the inlined copy', () => {
    expect(instructionsFileRef(agent, '/ws/core/Agents/triage.json')).toEqual({
      location: './instructions.md',
      encoding: 'B64',
      text: 'Be brief.',
      absolutePath: '/ws/core/Agents/instructions.md',
    });
    expect(instructionsFileRef({ attributes: { instructions: { text: 'x' } } }, '/a.json')).toBeNull();
  });

  it('re-encodes file text into code and ignores newline-only differences', () => {
    const draft = structuredClone(agent) as Record<string, unknown>;
    setInstructionsCode(draft, 'Be very brief.');
    expect(atob((draft.attributes as { instructions: { code: string } }).instructions.code)).toBe('Be very brief.');
    expect(sameInstructionsText('a\r\nb\n', 'a\nb')).toBe(true);
    expect(sameInstructionsText('a', 'b')).toBe(false);
  });
});
