/**
 * Runtime Phase B for AI agents and Phase A for the agent prompt:
 * - a kind-1 tool binding edits `binding.input` / `binding.output` (declarative, the default) or
 *   `binding.mapping` (C#), never both; untouched members save back unchanged;
 * - the state prompt accepts a Dynamic Expresso expression (`location: "dynamicExpresso"`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AgentToolsSection } from './components/AgentToolsSection';
import { withBindingUpdate, type Json } from './agentDocument';
import { setSetExpression, switchToDeclarative, switchToScript } from '../save-component/declarative-mapping/declarativeMapping';
import { diagnoseExpression } from '../expressions/tokenizeExpression';
import { AgentStateTab } from '../canvas-interaction/components/panels/tabs/agent/AgentStateTab';

const task = { key: 'get-customer', domain: 'core', flow: 'sys-tasks', version: '1.0.0' };
const SCRIPT = { location: './src/GetCustomerTool.csx', code: 'cmV0dXJuIG51bGw7', encoding: 'B64' };

const tool = (binding: Json): Json => ({
  kind: 1,
  name: 'get_customer',
  description: 'Customer by id.',
  parameters: { type: 'object', properties: { customerId: { type: 'string' } } },
  binding: { task, ...binding },
});

const render = (t: Json) =>
  renderToStaticMarkup(
    createElement(AgentToolsSection, {
      json: { attributes: { tools: [t] } },
      projectDomain: 'core',
      onReplaceTool: () => undefined,
      onAddTool: () => undefined,
      onRemoveTool: () => undefined,
    }),
  );

describe('kind-1 agent tool binding', () => {
  it('a new tool starts declarative with the tool-specific hints', () => {
    const html = render(tool({}));
    expect(html).toContain('data-testid="task-binding-mapping"');
    expect(html).toContain('data-testid="declarative-input"');
    expect(html).toContain('data-testid="declarative-output"');
    expect(html).toContain('the model receives');
  });

  it('a tool with a C# mapping opens in script mode', () => {
    const html = render(tool({ mapping: SCRIPT }));
    expect(html).toContain('data-testid="task-binding-mapping"');
    expect(html).not.toContain('data-testid="declarative-input"');
    expect(html).toContain('./src/GetCustomerTool.csx');
  });

  it('a tool with blocks opens declarative and shows them', () => {
    const html = render(tool({ output: { select: '$.body.customer' } }));
    expect(html).toContain('data-testid="declarative-output"');
    expect(html).toContain('$.body.customer');
  });

  it('an edit replaces the tool without touching its other members', () => {
    const before = tool({ input: { set: { '$.url': 'task.url', '$.body.id': 'input.customerId' } }, output: { into: '$.c' } });
    const text = JSON.stringify(before);
    const after = withBindingUpdate(before, (b) => setSetExpression(b, 'input', '$.url', 'task.url + "/x"'));
    expect(JSON.stringify(before)).toBe(text);
    expect(Object.keys(after)).toEqual(Object.keys(before));
    expect(Object.keys(after.binding as Json)).toEqual(['task', 'input', 'output']);
    expect(Object.keys(((after.binding as Json).input as Json).set as Json)).toEqual(['$.url', '$.body.id']);
    expect(after.parameters).toBe(before.parameters);
    expect(JSON.stringify(withBindingUpdate(before, () => undefined))).toBe(text);
  });

  it('switching modes never leaves both forms behind', () => {
    const both = tool({ mapping: SCRIPT, output: { into: '$.c' } });
    const script = withBindingUpdate(both, switchToScript).binding as Json;
    expect(script).toEqual({ task, mapping: SCRIPT });
    const declarative = withBindingUpdate(both, switchToDeclarative).binding as Json;
    expect(declarative).toEqual({ task, output: { into: '$.c' } });
  });
});

describe('agent prompt as a Dynamic Expresso expression', () => {
  const FIXTURES = join(__dirname, '__fixtures__', 'ai-agent-lab', 'workflows', 'ai-agent-lab.json');
  const stateWithPrompt = (prompt: Json) => {
    const workflow = JSON.parse(readFileSync(FIXTURES, 'utf8')) as { attributes: { states: Json[] } };
    const state = workflow.attributes.states.find((s) => s.stateType === 6) as Json & { key: string };
    return { ...state, agent: { ...(state.agent as Json), prompt } } as Json & { key: string };
  };

  it('edits an expression prompt inline with the string-kind help', () => {
    const html = renderToStaticMarkup(
      createElement(AgentStateTab, {
        state: stateWithPrompt({ location: 'dynamicExpresso', encoding: 'NAT', code: '"Classify: " + data.message' }),
      }),
    );
    expect(html).toContain('data-testid="dynamic-expression"');
    expect(html).toContain('String result (the prompt)');
  });

  it('keeps an empty expression prompt in the expression editor', () => {
    const html = renderToStaticMarkup(
      createElement(AgentStateTab, { state: stateWithPrompt({ location: 'dynamicExpresso', encoding: 'NAT', code: '' }) }),
    );
    expect(html).toContain('data-testid="dynamic-expression"');
    expect(html).toContain('publish rejects it');
  });
});

describe('agent tool expression binding — highlighting and diagnostics', () => {
  const scriptTool = (code: string): Json => ({
    kind: 2,
    name: 'calc',
    description: 'Calc.',
    parameters: { type: 'object', properties: {} },
    binding: { code: { location: 'dynamicExpresso', encoding: 'NAT', code } },
  });

  it('renders the expression through the highlighted textarea', () => {
    expect(render(scriptTool('args.count + 1'))).toContain('data-testid="expression-mirror"');
  });

  it('data.x has no diagnostic, foo.x has one', () => {
    expect(diagnoseExpression('data.x', 'agentTool')).toHaveLength(0);
    expect(diagnoseExpression('foo.x', 'agentTool').length).toBeGreaterThan(0);
    expect(render(scriptTool('data.x'))).not.toContain('data-testid="expression-diagnostic"');
    expect(render(scriptTool('foo.x'))).toContain('data-testid="expression-diagnostic"');
  });
});
