import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AgentEditorPanel } from './components/AgentEditorPanel';
import { AgentStateTab } from '../canvas-interaction/components/panels/tabs/agent/AgentStateTab';

const FIXTURES = join(__dirname, '__fixtures__', 'ai-agent-lab');
const read = (dir: string, name: string) => JSON.parse(readFileSync(join(FIXTURES, dir, name), 'utf8')) as Record<string, any>;

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
    const state = workflow.attributes.states.find((s: { stateType: number }) => s.stateType === 6);
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
    const state = workflow.attributes.states.find((s: { stateType: number }) => s.stateType === 6);
    const html = renderToStaticMarkup(createElement(AgentStateTab, { state }));
    expect(html).toContain('ai-cards-agent@1.0.0');
    expect(html).toContain('ai-loans-agent@1.0.0');
    expect(html).toContain('Card issues.');
  });
});
