/**
 * A multi-task function's `onExecutionTasks` bindings get the same mapping field as a single-task function:
 * declarative input / output blocks by default, the C# mapping as the escape hatch.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The "open in modal" affordance drags in @burgan-tech/pseudo-ui (a `primereact/api` directory import Node's
// ESM resolver rejects); it is irrelevant here (same stub as FunctionContractSection.vitest.test.tsx).
vi.mock('../../save-component/components/OpenVnextComponentInModalButton.js', () => ({
  OpenVnextComponentInModalButton: () => null,
}));

const { FunctionMultipleTasksSection } = await import('./FunctionMultipleTasksSection');

const task = { key: 'score-task', domain: 'core', flow: 'sys-tasks', version: '1.0.0' };
const render = (tasks: unknown[]) =>
  renderToStaticMarkup(
    createElement(FunctionMultipleTasksSection, { tasks, output: null, onChange: () => undefined, functionKey: 'score-fn' }),
  );

describe('FunctionMultipleTasksSection task bindings', () => {
  it('every binding uses the declarative-first mapping field', () => {
    const html = render([
      { order: 1, task },
      { order: 2, task: { ...task, key: 'other' }, output: { into: '$.score' } },
    ]);
    expect(html.match(/data-testid="task-binding-mapping"/g)).toHaveLength(2);
    expect(html).toContain('data-testid="declarative-output"');
  });

  it('a binding with a C# mapping keeps the script editor', () => {
    const html = render([{ order: 1, task, mapping: { location: './src/Score.csx', code: 'cmV0dXJuIG51bGw7', encoding: 'B64' } }]);
    expect(html).toContain('data-testid="task-binding-mapping"');
    expect(html).toContain('./src/Score.csx');
  });
});

describe('FunctionMultipleTasksSection output', () => {
  const renderOutput = (output: unknown, rawResponse = false) =>
    renderToStaticMarkup(
      createElement(FunctionMultipleTasksSection, {
        tasks: [{ order: 1, task }],
        output: output as never,
        rawResponse,
        onChange: () => undefined,
        functionKey: 'score-fn',
      }),
    );

  it('a block output opens the declarative editor and warns about statusCode without rawResponse', () => {
    const html = renderOutput({ set: { '$.statusCode': '201' } });
    expect(html).toContain('data-testid="functionOutput-mapping"');
    expect(html).toContain('rawResponse');
    expect(renderOutput({ set: { '$.statusCode': '201' } }, true)).not.toContain('ignores $.statusCode');
  });

  it('a script output keeps the script editor', () => {
    const html = renderOutput({ location: './src/Out.csx', code: 'cmV0dXJuIG51bGw7', encoding: 'B64' });
    expect(html).toContain('./src/Out.csx');
    const outputField = html.slice(html.indexOf('data-testid="functionOutput-mapping"'));
    expect(outputField).toMatch(/^[^]*?aria-checked="true"[^>]*>C# script</);
    expect(outputField).not.toContain('aria-label="output select"');
  });
});
