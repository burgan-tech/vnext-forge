import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// `PseudoUiOrJsonBlock` is mocked everywhere else in this module for the same
// reason: it pulls in pseudo-ui rendering machinery this suite has no need to
// exercise. Capturing the props (rather than the plan's bare `() => null`)
// is what lets the outputView-delegation tests below actually assert
// something — an uncaptured mock covers nothing about what was passed in.
const pseudoUiOrJsonBlockCalls: unknown[] = [];
vi.mock('../../quick-run/pseudo-ui/PseudoUiOrJsonBlock', () => ({
  PseudoUiOrJsonBlock: (props: unknown) => {
    pseudoUiOrJsonBlockCalls.push(props);
    return null;
  },
}));

// `CopyableJsonBlock` wraps a real Monaco editor. Its initial render is safe
// without jsdom (Monaco only touches the DOM from a `useEffect`, which
// `renderToStaticMarkup` never runs), so mocking it is not required to avoid
// a crash here. It is mocked anyway, capturing the props, because the point
// of the tests below is to assert exactly *which value* reaches it — the
// `??` vs `'json' in exchange` distinction is invisible from the rendered
// HTML alone (a real Monaco editor prints the same JSON text either way).
const copyableJsonBlockCalls: unknown[] = [];
vi.mock('../../quick-run/components/CopyableJsonBlock', () => ({
  CopyableJsonBlock: (props: unknown) => {
    copyableJsonBlockCalls.push(props);
    return null;
  },
  JsonEditorWithCopy: () => null,
}));

const { FunctionRunResponsePane } = await import('./FunctionRunResponsePane.js');

const exchange = (over: Partial<Record<string, unknown>> = {}) => ({
  status: 200,
  contentType: 'application/json',
  responseHeaders: {},
  body: '{}',
  ...over,
});

function render(props: Record<string, unknown>) {
  pseudoUiOrJsonBlockCalls.length = 0;
  copyableJsonBlockCalls.length = 0;
  return renderToStaticMarkup(createElement(FunctionRunResponsePane, props as never));
}

describe('FunctionRunResponsePane', () => {
  it('shows the numeric status for a success', () => {
    expect(render({ response: exchange(), durationMs: 12 })).toContain('200');
  });

  it('shows an error status rather than hiding it', () => {
    // A function under development legitimately returns 5xx; the runner must
    // render it like any other response.
    const html = render({
      response: exchange({ status: 500, body: 'boom', contentType: 'text/plain' }),
      durationMs: 5,
    });
    expect(html).toContain('500');
    expect(html).toContain('boom');
  });

  it('renders the authorization banner for 403', () => {
    expect(render({ response: exchange({ status: 403 }), durationMs: 3 })).toContain('not allowed to run');
  });

  it('does not render the authorization banner for 404', () => {
    expect(render({ response: exchange({ status: 404 }), durationMs: 3 })).not.toContain('not allowed to run');
  });

  it('lists response headers', () => {
    const html = render({
      response: exchange({ responseHeaders: { 'x-trace-id': 'trace-42' } }),
      durationMs: 1,
    });
    expect(html).toContain('x-trace-id');
    expect(html).toContain('trace-42');
  });

  it('renders nothing before the first invoke', () => {
    expect(render({ response: null, durationMs: null })).toBe('');
  });

  it('surfaces a malformed-JSON body distinctly rather than showing it as plain text', () => {
    // `jsonParseError` exists specifically so the UI can say "claimed JSON,
    // sent something malformed" instead of silently rendering raw text that
    // looks like an ordinary text/plain reply.
    const html = render({
      response: exchange({ body: '{not valid', jsonParseError: 'Unexpected token n in JSON' }),
      durationMs: 2,
    });
    expect(html).toContain('did not parse');
    expect(html).toContain('Unexpected token n in JSON');
    expect(html).toContain('{not valid');
  });

  it('does not show the malformed-JSON message for a clean parse', () => {
    const html = render({ response: exchange(), durationMs: 1 });
    expect(html).not.toContain('did not parse');
  });

  it('passes a literal JSON null body through as the parsed value, not the raw body text', () => {
    // The documented hazard: `json ?? body` cannot tell "parsed to null" apart
    // from "no json field at all" and would substitute the raw body string.
    // `'json' in exchange` is the correct presence check.
    render({ response: exchange({ body: 'null', json: null }), durationMs: 1 });
    expect(copyableJsonBlockCalls).toHaveLength(1);
    expect((copyableJsonBlockCalls[0] as { value: unknown }).value).toBeNull();
  });

  it('falls back to the raw body for a non-JSON content type without a json field', () => {
    render({ response: exchange({ contentType: 'text/plain', body: 'plain text' }), durationMs: 1 });
    expect(copyableJsonBlockCalls).toHaveLength(0);
  });

  it('delegates JSON body rendering to CopyableJsonBlock with the parsed value', () => {
    render({ response: exchange({ json: { a: 1 } }), durationMs: 1 });
    expect(copyableJsonBlockCalls).toHaveLength(1);
    expect((copyableJsonBlockCalls[0] as { value: unknown }).value).toEqual({ a: 1 });
  });

  it('delegates to PseudoUiOrJsonBlock instead of the raw body when an output view is present', () => {
    const outputView = { key: 'k', type: 'pseudo-ui', content: { component: 'Column' } };
    render({ response: exchange({ json: { component: 'Column' } }), durationMs: 1, outputView });
    expect(pseudoUiOrJsonBlockCalls).toHaveLength(1);
    expect(copyableJsonBlockCalls).toHaveLength(0);
    expect((pseudoUiOrJsonBlockCalls[0] as { view: unknown }).view).toEqual(outputView);
  });

  it('does not call PseudoUiOrJsonBlock when there is no output view', () => {
    render({ response: exchange(), durationMs: 1, outputView: null });
    expect(pseudoUiOrJsonBlockCalls).toHaveLength(0);
  });
});
