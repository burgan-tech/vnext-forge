import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunInfoError } from './FunctionRunInfoError.js';

// React renders a true boolean `disabled` prop as the literal attribute
// `disabled=""`. Counting it directly (rather than a regex over `<button…`)
// avoids getting the match direction or an incidental class-name substring
// wrong — see `FunctionRunToolbar.vitest.test.tsx` for the established
// pattern this follows.
const disabledCount = (html: string) => (html.match(/ disabled=""/g) ?? []).length;

function isButtonDisabled(html: string, text: string): boolean {
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  const button = buttons.find((btn) => btn.includes(text));
  return button?.includes(' disabled=""') ?? false;
}

const base = {
  message: 'The function info request failed with status 500.',
  isAuthorizationError: false,
  loading: false,
  canRetry: true,
  onRetry: () => undefined,
  onOpenHeaders: () => undefined,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunInfoError, { ...base, ...over } as never));

describe('FunctionRunInfoError', () => {
  it('shows the message it was given', () => {
    expect(render({ message: 'boom' })).toContain('boom');
  });

  it('always offers a Retry control, not only for authorization failures', () => {
    const html = render({ isAuthorizationError: false });
    expect(html).toContain('Retry');
    expect(disabledCount(html)).toBe(0);
  });

  it('reads as in-flight and is disabled while loading', () => {
    const html = render({ loading: true });
    expect(html).toContain('Retrying');
    expect(isButtonDisabled(html, 'Retrying')).toBe(true);
    // Mutation guard: nothing is disabled in the ordinary, non-loading state.
    expect(disabledCount(render())).toBe(0);
  });

  it('disables Retry when the F/I scope ids are not both present', () => {
    expect(isButtonDisabled(render({ canRetry: false }), 'Retry')).toBe(true);
  });

  it('offers an Open Headers shortcut only for an authorization failure', () => {
    expect(render({ isAuthorizationError: true })).toContain('Open Headers');
    expect(render({ isAuthorizationError: false })).not.toContain('Open Headers');
  });

  it('wraps the message in ui/Alert rather than bare text (3d)', () => {
    // `data-slot="alert"` only appears when `Alert` itself renders — a
    // regression back to a plain `<div>` would drop it while every text
    // assertion above kept passing.
    expect(render()).toContain('data-slot="alert"');
  });

  it('uses the warning alert styling for an authorization failure and destructive otherwise', () => {
    const authHtml = render({ isAuthorizationError: true });
    const otherHtml = render({ isAuthorizationError: false });
    expect(authHtml).toContain('border-warning-border');
    expect(authHtml).not.toContain('border-destructive-border');
    expect(otherHtml).toContain('border-destructive-border');
    expect(otherHtml).not.toContain('border-warning-border');
  });
});
