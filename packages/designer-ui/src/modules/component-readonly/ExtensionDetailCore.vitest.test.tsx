import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExtensionDetailCore } from './ExtensionDetailCore.js';

describe('ExtensionDetailCore', () => {
  it('renders metadata, type/scope labels, defined flows and task ref', () => {
    const html = renderToStaticMarkup(
      h(ExtensionDetailCore, {
        json: {
          key: 'audit-ext',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-extensions',
          attributes: {
            type: 3,
            scope: 3,
            definedFlows: ['wf-a', 'wf-b'],
            task: {
              order: 1,
              task: { key: 'audit-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
              mapping: {
                location: './src/AuditMapping.csx',
                code: 'Ly8gbWFwcGluZw==',
                encoding: 'B64',
              },
            },
          },
        },
      }),
    );
    expect(html).toContain('Defined Flows');
    expect(html).toContain('wf-a');
    expect(html).toContain('Everywhere'); // scope 3 label
    expect(html).toContain('audit-task'); // task ref card
    expect(html).toContain('AuditMapping.csx');
    expect(html).not.toContain('Replace'); // no editor action buttons
  });

  it('shows an empty state when no task is attached', () => {
    const html = renderToStaticMarkup(
      h(ExtensionDetailCore, {
        json: {
          key: 'e1',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-extensions',
          attributes: { type: 1, scope: 1 },
        },
      }),
    );
    expect(html).toContain('No task configured');
    expect(html).not.toContain('Defined Flows'); // type 1 -> section hidden
  });

  it('renders a navigable ref button when onNavigateToComponent is provided', () => {
    // renderToStaticMarkup cannot simulate clicks; assert the button wrapper exists instead
    const html = renderToStaticMarkup(
      h(ExtensionDetailCore, {
        json: {
          key: 'e2',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-extensions',
          attributes: {
            type: 1,
            scope: 1,
            task: { order: 1, task: { key: 't-x', flow: 'sys-tasks' } },
          },
        },
        onNavigateToComponent: () => undefined,
      }),
    );
    expect(html).toContain('aria-label="Open t-x"');

    // A ref without `flow` still navigates (the handler falls back to sys-tasks).
    const htmlWithoutFlow = renderToStaticMarkup(
      h(ExtensionDetailCore, {
        json: {
          key: 'e3',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-extensions',
          attributes: { type: 1, scope: 1, task: { task: { key: 't-y' } } },
        },
        onNavigateToComponent: () => undefined,
      }),
    );
    expect(htmlWithoutFlow).toContain('aria-label="Open t-y"');
  });

  it('renders a task written as a DIRECT reference (canonical template shape)', () => {
    // example-extension.json stores the ref directly under attributes.task.
    const html = renderToStaticMarkup(
      h(ExtensionDetailCore, {
        json: {
          key: 'e4',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-extensions',
          attributes: {
            type: 1,
            scope: 1,
            task: { key: 'direct-task', domain: 'core', version: '1.0.0', flow: 'sys-tasks' },
          },
        },
      }),
    );
    expect(html).toContain('direct-task');
    expect(html).not.toContain('No task configured');
  });
});
