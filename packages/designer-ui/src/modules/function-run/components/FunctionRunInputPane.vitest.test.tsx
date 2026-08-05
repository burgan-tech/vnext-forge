import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const seenPseudoUiProps: Record<string, unknown>[] = [];

vi.mock('../../quick-run/pseudo-ui/PseudoUiOrJsonBlock', () => ({
  PseudoUiOrJsonBlock: (props: Record<string, unknown>) => {
    seenPseudoUiProps.push(props);
    return null;
  },
}));
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
  inputView: null,
  onViewFormChange: () => undefined,
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

afterEach(() => {
  seenPseudoUiProps.length = 0;
});

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
    expect(render({ mode: 'payload' })).toContain('aria-checked="true"');
  });

  it('renders the input view with no delegate — the view collects input, the runner sends it', () => {
    const view = { key: 'branch-form', type: 'pseudo-ui', content: { component: 'Column' } };
    render({ hasInputView: true, mode: 'view', inputView: view });

    expect(seenPseudoUiProps).toHaveLength(1);
    const props = seenPseudoUiProps[0];
    expect(props.view).toBe(view);
    // The runner owns Invoke, not the view; a `delegate` would let the view
    // submit on its own, which is exactly the design this pane must not
    // reintroduce.
    expect(props.delegate).toBeUndefined();
    expect(typeof props.onFormChange).toBe('function');
  });

  it('does not render the view block at all in payload mode', () => {
    const view = { key: 'branch-form', type: 'pseudo-ui', content: {} };
    render({ hasInputView: true, mode: 'payload', inputView: view });
    expect(seenPseudoUiProps).toHaveLength(0);
  });
});

// Fix 2: the payload editor (and the toggle above it) is hidden entirely for
// a body-less verb — `payloadAvailable` is how the shell communicates that,
// computed from `carriesBody` in `functionRunPayload.ts`.
describe('FunctionRunInputPane — payloadAvailable (Fix 2)', () => {
  it('does not render the two-way toggle when Payload is unavailable', () => {
    const html = render({ payloadAvailable: false, hasInputView: true, inputView: { key: 'v', type: 't', content: {} } });
    expect(html).not.toContain('radiogroup');
    expect(html).not.toContain('>Payload<');
  });

  it('renders the view directly, with no toggle, when Payload is unavailable but a view exists', () => {
    const view = { key: 'branch-form', type: 'pseudo-ui', content: { component: 'Column' } };
    render({ payloadAvailable: false, hasInputView: true, inputView: view, mode: 'payload' });
    // Forced to View even though the raw `mode` prop still says 'payload' —
    // that stored mode is left untouched, only the render decision changes.
    expect(seenPseudoUiProps).toHaveLength(1);
    expect(seenPseudoUiProps[0]?.view).toBe(view);
  });

  it('renders nothing — not the payload editor — when Payload is unavailable and no view exists either', () => {
    // The dedicated query-string input (rendered elsewhere, in the toolbar)
    // is the whole input surface for this combination; a blank pane here is
    // correct, not a bug.
    const html = render({ payloadAvailable: false, hasInputView: false, inputView: null, mode: 'payload' });
    expect(html).not.toContain('Content type');
    expect(seenPseudoUiProps).toHaveLength(0);
  });

  it('still offers the toggle and the payload editor when Payload is available', () => {
    const html = render({ payloadAvailable: true, hasInputView: false });
    expect(html).toContain('radiogroup');
    expect(html).toContain('Content type');
  });
});
