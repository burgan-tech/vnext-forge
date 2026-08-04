import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionDetailCore } from './FunctionDetailCore.js';

const base = { key: 'calc-fee', version: '1.0.0', domain: 'core', flow: 'sys-functions' };

describe('FunctionDetailCore', () => {
  it('renders single-task mode with scope label and mapping', () => {
    const html = renderToStaticMarkup(
      h(FunctionDetailCore, {
        json: {
          ...base,
          attributes: {
            scope: 'D',
            task: {
              order: 1,
              task: { key: 'fee-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
              mapping: { location: './src/FeeMapping.csx', code: 'Ly8gZmVl', encoding: 'B64' },
            },
          },
        },
      }),
    );
    // Asserts the rendered *value* of the Scope field, not the bare word
    // "Domain" — ReadOnlyMetadataSection always emits a "Domain" label, so a
    // plain toContain('Domain') would pass even with scope labeling broken.
    // The metadata Domain field renders value="core", so this is unambiguous.
    expect(html).toContain('value="Domain"'); // scope 'D' -> "Domain"
    expect(html).toContain('fee-task');
    expect(html).toContain('FeeMapping.csx');
    expect(html).toContain('Single task');
  });

  it('renders multi-task mode with ordered refs, output mapping and cache', () => {
    const html = renderToStaticMarkup(
      h(FunctionDetailCore, {
        json: {
          ...base,
          attributes: {
            scope: 'I',
            rawResponse: true,
            onExecutionTasks: [
              {
                order: 1,
                task: { key: 't-one', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
              },
              {
                order: 2,
                task: { key: 't-two', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
              },
            ],
            output: { location: './src/Output.csx', code: 'Ly8gb3V0', encoding: 'B64' },
            cache: { key: 'fee-cache', ttlInSeconds: 60, varyByHeaders: ['X-Tenant'] },
          },
        },
      }),
    );
    expect(html).toContain('t-one');
    expect(html).toContain('t-two');
    expect(html).toContain('#2');
    expect(html).toContain('Output Mapping');
    expect(html).toContain('Raw response');
    expect(html).toContain('2 tasks');
    expect(html).toContain('fee-cache');
    expect(html).toContain('X-Tenant');
  });

  it('renders an empty execution state without crashing', () => {
    const html = renderToStaticMarkup(
      h(FunctionDetailCore, { json: { ...base, attributes: { scope: 'F' } } }),
    );
    expect(html).toContain('No task executions configured');
    expect(html).toContain('Workflow'); // scope F label
    expect(html).not.toContain('Output Mapping'); // no output -> card hidden
    expect(html).not.toContain('Cache'); // no cache -> card hidden
  });

  it('renders a single task written as a DIRECT reference (canonical template shape)', () => {
    // example-function.json stores the ref directly under attributes.task —
    // no {order, task} nesting. Real-world documents use this shape.
    const html = renderToStaticMarkup(
      h(FunctionDetailCore, {
        json: {
          ...base,
          attributes: {
            scope: 'D',
            task: { key: 'get-branches-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
          },
        },
      }),
    );
    expect(html).toContain('get-branches-task');
    expect(html).toContain('Single task');
    expect(html).not.toContain('No task executions configured');
  });

  it('does not let an empty onExecutionTasks array shadow the single task', () => {
    const html = renderToStaticMarkup(
      h(FunctionDetailCore, {
        json: {
          ...base,
          attributes: {
            scope: 'I',
            onExecutionTasks: [],
            task: {
              order: 1,
              task: { key: 'lonely-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
            },
          },
        },
      }),
    );
    expect(html).toContain('lonely-task');
    expect(html).toContain('Single task');
  });
});

/**
 * The monitoring app renders this component, so the read-only view has to
 * understand every contract wire shape the editor can write — otherwise a
 * function edited in Forge would show up incomplete there.
 */
describe('FunctionDetailCore — contract', () => {
  const withAttributes = (attributes: Record<string, unknown>) =>
    renderToStaticMarkup(
      h(FunctionDetailCore, {
        json: {
          ...base,
          attributes: {
            scope: 'D',
            task: { key: 'fee-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
            ...attributes,
          },
        },
      }),
    );

  it('omits the Contract card entirely when no contract field is set', () => {
    expect(withAttributes({})).not.toContain('Contract');
  });

  it('renders the declared verbs as badges', () => {
    const html = withAttributes({ verbs: ['GET', 'DELETE'] });
    expect(html).toContain('Contract');
    expect(html).toContain('GET');
    expect(html).toContain('DELETE');
    expect(html).not.toContain('PATCH');
  });

  it('renders a single-reference slot', () => {
    const html = withAttributes({
      inputSchema: { key: 'fee-input', domain: 'core', version: '2.0.0', flow: 'sys-schemas' },
    });
    expect(html).toContain('Input Schema');
    expect(html).toContain('fee-input');
    expect(html).toContain('v2.0.0');
    expect(html).toContain('sys-schemas');
  });

  it('renders rule entries in order, marking the fallback', () => {
    const html = withAttributes({
      outputView: [
        {
          rule: { location: './src/Rule.csx', code: 'Ly8gcnVsZQ==', encoding: 'B64' },
          view: { key: 'detailed-view', domain: 'core', version: '1.0.0', flow: 'sys-views' },
          loadData: true,
        },
        { view: { key: 'summary-view', domain: 'core', version: '1.0.0', flow: 'sys-views' } },
      ],
    });
    expect(html).toContain('Output View');
    expect(html).toContain('detailed-view');
    expect(html).toContain('summary-view');
    expect(html).toContain('Fallback');
    expect(html).toContain('Loads data');
    expect(html.indexOf('detailed-view')).toBeLessThan(html.indexOf('summary-view'));
  });

  it('reads the { views: [...] } wrapper wire shape', () => {
    const html = withAttributes({
      inputView: {
        views: [{ view: { key: 'wrapped-view', domain: 'core', version: '1.0.0', flow: 'sys-views' } }],
      },
    });
    expect(html).toContain('wrapped-view');
  });

  it('renders a file reference rather than claiming nothing is configured', () => {
    const html = withAttributes({ outputSchema: { ref: './schemas/out.json' } });
    expect(html).toContain('./schemas/out.json');
    expect(html).toContain('file reference');
    expect(html).not.toContain('No schema configured');
  });

  it('reports an unrecognized slot value instead of rendering it as empty', () => {
    const html = withAttributes({ inputView: 'nonsense' });
    expect(html).toContain('Unrecognized view contract');
  });

  it('renders every slot when all four are set', () => {
    const ref = (flow: string) => ({ key: `c-${flow}`, domain: 'core', version: '1.0.0', flow });
    const html = withAttributes({
      verbs: ['POST'],
      inputSchema: ref('sys-schemas'),
      outputSchema: ref('sys-schemas'),
      inputView: ref('sys-views'),
      outputView: ref('sys-views'),
    });
    for (const label of ['Input Schema', 'Output Schema', 'Input View', 'Output View']) {
      expect(html).toContain(label);
    }
  });
});
