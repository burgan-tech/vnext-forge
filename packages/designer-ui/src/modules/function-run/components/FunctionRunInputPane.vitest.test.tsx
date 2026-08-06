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
    const html = render({ mode: 'payload' });
    const triggers = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
    const payloadTrigger = triggers.find((t) => t.includes('>Payload<'));
    const viewTrigger = triggers.find((t) => t.includes('>View<'));
    expect(payloadTrigger).toContain('aria-selected="true"');
    expect(viewTrigger).toContain('aria-selected="false"');
  });

  it('renders the input view, forwarding the shell\'s delegate and schema resolver', () => {
    const view = { key: 'branch-form', type: 'pseudo-ui', content: { component: 'Column' } };
    const delegate = {
      requestData: () => Promise.resolve(undefined),
      loadComponent: () => Promise.resolve({} as never),
      onAction: () => Promise.resolve(undefined),
    };
    const resolveSchema = () => Promise.resolve(null);
    render({ hasInputView: true, mode: 'view', inputView: view, delegate, resolveSchema });

    expect(seenPseudoUiProps).toHaveLength(1);
    const props = seenPseudoUiProps[0];
    expect(props.view).toBe(view);
    // Wiring the view's own submit button / `x-lov` dropdowns to the shell's
    // single Invoke path is the whole point of this task — a pane that
    // silently drops the prop it was handed would look identical from the
    // "always offers Payload" tests above, so this is asserted directly.
    expect(props.delegate).toBe(delegate);
    expect(props.resolveSchema).toBe(resolveSchema);
    expect(typeof props.onFormChange).toBe('function');
  });

  it('renders the input view with no delegate when the shell provides none', () => {
    const view = { key: 'branch-form', type: 'pseudo-ui', content: { component: 'Column' } };
    render({ hasInputView: true, mode: 'view', inputView: view });
    expect(seenPseudoUiProps[0]?.delegate).toBeUndefined();
    expect(seenPseudoUiProps[0]?.resolveSchema).toBeUndefined();
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
    expect(html).not.toContain('role="tablist"');
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
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Content type');
  });
});

// I4-follow-up: `declaredButUnavailable` distinguishes "no view was ever
// declared" (blank pane, tested above) from "a view was declared but could
// not be loaded" (an explanatory error inside the section chrome).
describe('FunctionRunInputPane — inputViewDeclaredButUnavailable', () => {
  it('shows the section chrome with an explanatory error, not a blank pane', () => {
    const html = render({
      mode: 'view',
      payloadAvailable: false,
      hasInputView: false,
      inputViewDeclaredButUnavailable: true,
      inputView: null,
    });
    expect(html).toContain('could not be loaded');
    expect(seenPseudoUiProps).toHaveLength(0);
  });

  it('does not render the error, and stays a blank pane, when a view was never declared at all', () => {
    // The mutation this guards against: dropping the `hasInputView ||
    // inputViewDeclaredButUnavailable` condition down to just the latter,
    // which would make every "no view" case show chrome.
    const html = render({
      mode: 'view',
      payloadAvailable: false,
      hasInputView: false,
      inputViewDeclaredButUnavailable: false,
      inputView: null,
    });
    expect(html).not.toContain('could not be loaded');
    expect(html).not.toContain('This function declares no input view');
  });

  it('shows the section title even when the view is unavailable', () => {
    const html = render({
      mode: 'view',
      payloadAvailable: false,
      hasInputView: false,
      inputViewDeclaredButUnavailable: true,
      inputView: null,
    });
    expect(html).toContain('Input view');
  });
});
