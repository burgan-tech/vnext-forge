import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunEndpointBar } from './FunctionRunEndpointBar.js';

// `ui/Button`'s class list includes the literal text `disabled:cursor-not-allowed`
// on every render, so `/<button[^>]*disabled/` matches regardless of whether
// anything is actually disabled. Count the real HTML attribute instead —
// React renders a true boolean `disabled` prop as `disabled=""`.
const disabledCount = (html: string) => (html.match(/ disabled=""/g) ?? []).length;

function findButton(html: string, text: string): string | undefined {
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return buttons.find((btn) => btn.includes(text));
}

const base = {
  verbs: ['GET', 'POST'] as const,
  verb: 'GET' as const,
  onVerbChange: () => undefined,
  endpoint: '/api/v1/core/functions/get-branches',
  canInvoke: true,
  invokeDisabledReason: null,
  invoking: false,
  onInvoke: () => undefined,
  onOpenHeaders: () => undefined,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunEndpointBar, { ...base, ...over } as never));

describe('FunctionRunEndpointBar', () => {
  it('offers exactly the verbs it was given', () => {
    const html = render();
    expect(html).toContain('GET');
    expect(html).toContain('POST');
    expect(html).not.toContain('PATCH');
  });

  it('shows the resolved endpoint as truncating mono text carrying the full value in its title', () => {
    const html = render({ endpoint: '/api/v1/core/workflows/onboarding/instances/inst-1/functions/get-branches' });
    expect(html).toContain('title="/api/v1/core/workflows/onboarding/instances/inst-1/functions/get-branches"');
    expect(html).toContain('/api/v1/core/workflows/onboarding/instances/inst-1/functions/get-branches');
    // Mutation guard for the truncate/mono styling itself.
    const endpointSpan = /<span[^>]*title="\/api\/v1[^"]*"[^>]*>/.exec(html)?.[0];
    expect(endpointSpan).toContain('truncate');
    expect(endpointSpan).toContain('font-mono');
  });

  it('renders Send as the primary action and Headers as the quieter one', () => {
    const html = render();
    const sendButton = findButton(html, 'Send');
    const headersButton = findButton(html, 'Headers');
    expect(sendButton).toBeDefined();
    expect(headersButton).toBeDefined();
    // `default` variant is this package's solid/primary look (`bg-primary`);
    // `ghost` carries no such background — this is the inversion fix.
    expect(sendButton).toContain('bg-primary');
    expect(headersButton).not.toContain('bg-primary');
  });

  it('disables Send specifically (not Headers) when invoke is gated, and says why', () => {
    const html = render({ canInvoke: false, invokeDisabledReason: 'Enter an instance id to run this function.' });
    expect(html).toContain('Enter an instance id to run this function.');
    expect(findButton(html, 'Send')).toContain(' disabled=""');
    expect(findButton(html, 'Headers')).not.toContain(' disabled=""');
    expect(disabledCount(html)).toBe(1);
  });

  it('disables Send and relabels it while a call is in flight', () => {
    const html = render({ invoking: true });
    expect(html).toContain('Invoking…');
    expect(html).not.toMatch(/>Send</);
    expect(disabledCount(html)).toBe(1);
  });

  it('is not disabled at all in the ordinary, enabled state', () => {
    // Mutation guard: nothing here is spuriously disabled.
    expect(disabledCount(render())).toBe(0);
  });

  it('does not show a disabled reason when Send is enabled', () => {
    const html = render({ invokeDisabledReason: 'should not appear' });
    expect(html).not.toContain('should not appear');
  });
});
