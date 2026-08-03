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
