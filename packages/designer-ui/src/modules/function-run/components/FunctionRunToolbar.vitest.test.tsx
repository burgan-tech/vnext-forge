import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunToolbar } from './FunctionRunToolbar.js';

const base = {
  scope: 'D' as const,
  workflowKey: '',
  instanceId: '',
  onScopeIdsChange: () => undefined,
  queryString: '',
  onQueryStringChange: () => undefined,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunToolbar, { ...base, ...over } as never));

describe('FunctionRunToolbar', () => {
  it('hides the instance fields for a domain-scoped function', () => {
    const html = render();
    expect(html).not.toContain('Workflow key');
    expect(html).not.toContain('Instance id');
  });

  it('asks for workflow and instance for F and I scopes', () => {
    for (const scope of ['F', 'I']) {
      const html = render({ scope });
      expect(html).toContain('Workflow key');
      expect(html).toContain('Instance id');
    }
  });

  it('offers a query-string input for every scope, including a domain-scoped function', () => {
    // Fix 3: available regardless of verb or scope — a body-less verb still
    // needs somewhere to put query parameters now that its payload editor is
    // hidden, and a body-bearing verb can legitimately want both a body and
    // a query string.
    const html = render({ scope: 'D', queryString: 'a=1' });
    expect(html).toContain('Query string');
    expect(html).toContain('value="a=1"');
  });

  it('offers the query-string input for F/I scopes too, alongside the workflow/instance fields', () => {
    const html = render({ scope: 'F' });
    expect(html).toContain('Query string');
    expect(html).toContain('Workflow key');
  });

  it('no longer renders a verb select, Send, or Headers control — those moved to FunctionRunEndpointBar', () => {
    const html = render();
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<button');
  });
});
