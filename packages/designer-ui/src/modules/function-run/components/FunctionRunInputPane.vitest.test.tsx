import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../quick-run/components/CopyableJsonBlock', () => ({
  JsonEditorWithCopy: () => null,
  CopyableJsonBlock: () => null,
}));

const { FunctionRunInputPane } = await import('./FunctionRunInputPane.js');

// React renders a true boolean `disabled` prop as the literal attribute
// `disabled=""`. Counting it directly (rather than a regex over `<button…`)
// avoids getting the match direction or an incidental class-name substring
// wrong — see `FunctionRunToolbar.vitest.test.tsx` for where that bit.
const disabledCount = (html: string) => (html.match(/ disabled=""/g) ?? []).length;

const base = {
  mode: 'payload' as const,
  onModeChange: () => undefined,
  hasInputView: false,
  payloadAvailable: true,
  payloadEditorProps: {
    contentType: 'json' as const,
    onContentTypeChange: () => undefined,
    value: {},
    onChange: () => undefined,
    schema: null,
  },
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunInputPane, { ...base, ...over } as never));

describe('FunctionRunInputPane', () => {
  it('always offers the Payload mode, even when a view exists', () => {
    // Free input must never be taken away. Exactly one control may be
    // disabled in this pane (View, and only when there is no input view) —
    // asserting the count, rather than a substring match keyed to button
    // order, is what actually pins "Payload is never disabled" down.
    expect(disabledCount(render({ hasInputView: true, mode: 'view' }))).toBe(0);
    expect(disabledCount(render({ hasInputView: false }))).toBe(1);
  });

  it('disables the View mode with a reason when the contract declares none', () => {
    const html = render({ hasInputView: false });
    expect(disabledCount(html)).toBe(1);
    expect(html).toContain('declares no input view');
  });

  it('marks the active mode for assistive technology', () => {
    const html = render({ mode: 'payload' });
    const triggers = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
    const payloadTrigger = triggers.find((t) => t.includes('>Payload<'));
    const viewTrigger = triggers.find((t) => t.includes('>View<'));
    expect(payloadTrigger).toContain('aria-selected="true"');
    expect(viewTrigger).toContain('aria-selected="false"');
  });

  it('renders the payload editor in payload mode', () => {
    expect(render({ mode: 'payload' })).toContain('Content type');
  });

  it('points at the view above instead of re-rendering it in view mode', () => {
    // The view itself is a first-class section above the tab strip
    // (`FunctionRunInputViewSection`) — rendering it here as well would show
    // the same surface twice for a body-bearing verb.
    const html = render({ mode: 'view', hasInputView: true });
    expect(html).toContain('shown above');
    expect(html).not.toContain('Content type');
  });
});

// `payloadAvailable` is how the shell communicates a body-less verb, computed
// from `carriesBody`. This pane is only mounted inside the Body tab, which
// does not exist for such a verb — the branch is kept honest all the same.
describe('FunctionRunInputPane — payloadAvailable', () => {
  it('does not render the two-way toggle when Payload is unavailable', () => {
    const html = render({ payloadAvailable: false, hasInputView: true });
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('>Payload<');
  });

  it('does not render the payload editor when Payload is unavailable', () => {
    const html = render({ payloadAvailable: false, hasInputView: false, mode: 'payload' });
    expect(html).not.toContain('Content type');
  });

  it('still offers the toggle and the payload editor when Payload is available', () => {
    const html = render({ payloadAvailable: true, hasInputView: false });
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Content type');
  });
});
