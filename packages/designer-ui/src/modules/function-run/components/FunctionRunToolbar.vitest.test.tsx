import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunToolbar } from './FunctionRunToolbar.js';

// `ui/Button`'s class list includes the literal text `disabled:cursor-not-allowed`
// etc. on every render, so `/<button[^>]*disabled/` matches regardless of
// whether anything is actually disabled. Count the real HTML attribute
// instead — React renders a true boolean `disabled` prop as `disabled=""`.
const disabledCount = (html: string) => (html.match(/ disabled=""/g) ?? []).length;

const base = {
  verbs: ['GET', 'POST'] as const,
  verb: 'GET' as const,
  onVerbChange: () => undefined,
  canInvoke: true,
  invokeDisabledReason: null,
  invoking: false,
  onInvoke: () => undefined,
  onOpenHeaders: () => undefined,
  scope: 'D' as const,
  workflowKey: '',
  instanceId: '',
  onScopeIdsChange: () => undefined,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunToolbar, { ...base, ...over } as never));

describe('FunctionRunToolbar', () => {
  it('offers exactly the verbs it was given', () => {
    const html = render();
    expect(html).toContain('GET');
    expect(html).toContain('POST');
    expect(html).not.toContain('PATCH');
  });

  it('offers all four when the contract restricts nothing', () => {
    const html = render({ verbs: ['GET', 'POST', 'PATCH', 'DELETE'] });
    for (const verb of ['GET', 'POST', 'PATCH', 'DELETE']) expect(html).toContain(verb);
  });

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

  it('states why Invoke is disabled rather than just disabling it', () => {
    // A disabled control with no explanation is the failure mode this guards.
    const html = render({
      canInvoke: false,
      invokeDisabledReason: 'Enter an instance id to run this function.',
    });
    expect(html).toContain('Enter an instance id to run this function.');
    expect(disabledCount(html)).toBe(1);
  });

  it('disables Invoke while a call is in flight', () => {
    expect(disabledCount(render({ invoking: true }))).toBe(1);
    // Mutation guard: nothing is disabled in the ordinary, enabled state.
    expect(disabledCount(render())).toBe(0);
  });
});
