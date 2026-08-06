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

const { FunctionRunInputViewSection } = await import('./FunctionRunInputViewSection.js');

const VIEW = { key: 'branch-form', type: 'pseudo-ui', content: { component: 'Column' } };

const base = {
  view: null,
  loading: false,
  declaredButUnavailable: false,
  destination: 'body' as const,
  onFormChange: () => undefined,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunInputViewSection, { ...base, ...over } as never));

afterEach(() => {
  seenPseudoUiProps.length = 0;
});

describe('FunctionRunInputViewSection', () => {
  it('renders the view surface for every verb, body-bearing or not', () => {
    // The regression this whole component exists for: a GET/DELETE function
    // declaring an input view used to render nothing at all, because the view
    // lived inside the Body tab and that tab does not exist for a body-less
    // verb. Nothing here may depend on the verb except the caption.
    for (const destination of ['body', 'query', 'unused'] as const) {
      seenPseudoUiProps.length = 0;
      render({ view: VIEW, destination });
      expect(seenPseudoUiProps).toHaveLength(1);
      expect(seenPseudoUiProps[0]?.view).toBe(VIEW);
    }
  });

  it("forwards the shell's delegate and schema resolver", () => {
    // The delegate is what lets a button *inside* the view fire the invoke —
    // the case an informational view depends on entirely. A component that
    // silently dropped the prop would look identical in the markup.
    const delegate = {
      requestData: () => Promise.resolve(undefined),
      loadComponent: () => Promise.resolve({} as never),
      onAction: () => Promise.resolve(undefined),
    };
    const resolveSchema = () => Promise.resolve(null);
    render({ view: VIEW, delegate, resolveSchema });

    expect(seenPseudoUiProps[0]?.delegate).toBe(delegate);
    expect(seenPseudoUiProps[0]?.resolveSchema).toBe(resolveSchema);
    expect(typeof seenPseudoUiProps[0]?.onFormChange).toBe('function');
  });

  it('renders the view with no delegate when the shell provides none', () => {
    render({ view: VIEW });
    expect(seenPseudoUiProps[0]?.delegate).toBeUndefined();
    expect(seenPseudoUiProps[0]?.resolveSchema).toBeUndefined();
  });

  it('states where the values go, per destination', () => {
    expect(render({ view: VIEW, destination: 'body' })).toContain('request body');
    expect(render({ view: VIEW, destination: 'query' })).toContain('query parameters');
    // The trap worth naming: a button inside the view still fires Send, and
    // in Payload mode it sends the payload editor's content, not this view's.
    expect(render({ view: VIEW, destination: 'unused' })).toContain('payload editor');
  });

  it('shows the loading state instead of the surface while /info is in flight', () => {
    const html = render({ view: null, loading: true });
    expect(html).toContain('Loading view');
    expect(seenPseudoUiProps).toHaveLength(0);
  });

  it('explains a declared view that could not be loaded, rather than showing a blank section', () => {
    const html = render({ view: null, declaredButUnavailable: true });
    expect(html).toContain('could not be loaded');
    expect(html).toContain('Input view');
    expect(seenPseudoUiProps).toHaveLength(0);
  });

  it('does not claim a load failure when nothing was declared', () => {
    const html = render({ view: null, declaredButUnavailable: false });
    expect(html).not.toContain('could not be loaded');
  });
});
