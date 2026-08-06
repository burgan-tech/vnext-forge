import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunResponseHeaders } from './FunctionRunResponseHeaders.js';

const render = (headers: Record<string, string>) =>
  renderToStaticMarkup(createElement(FunctionRunResponseHeaders, { headers }));

describe('FunctionRunResponseHeaders', () => {
  it('pins x-trace-id in its own always-visible row, not behind the toggle', () => {
    const html = render({ 'x-trace-id': 'trace-42' });
    expect(html).toContain('x-trace-id');
    expect(html).toContain('trace-42');
    // Mutation guard: nothing else was passed, so if the trace id leaked
    // into the collapsed count it would show up here too.
    expect(html).not.toContain('Show 1 more headers');
  });

  it('matches x-trace-id case-insensitively', () => {
    const html = render({ 'X-Trace-Id': 'trace-99' });
    expect(html).toContain('trace-99');
  });

  it('renders no pinned row when there is no trace id header', () => {
    const html = render({ 'content-type': 'application/json' });
    expect(html).not.toContain('x-trace-id');
  });

  it('does not count x-trace-id toward the "show more" total', () => {
    // Exactly one other header besides the trace id — the toggle must say
    // "1", not "2", or the trace id has been double-counted into the
    // collapsed bucket despite already having its own pinned row.
    const html = render({ 'x-trace-id': 't-1', 'content-type': 'application/json' });
    expect(html).toContain('Show 1 more headers');
  });

  it('buckets a header from PROMINENT_HEADERS separately from an unlisted one, both behind the same toggle', () => {
    const html = render({ server: 'nginx', 'x-custom-thing': 'value' });
    expect(html).toContain('Show 2 more headers');
  });

  it('does not show prominent/other header rows before the toggle is used', () => {
    // Collapsed by default — the rows only exist once "Show N more" is
    // clicked, which this SSR-only harness cannot simulate, so their text
    // must not appear on first render.
    const html = render({ server: 'nginx' });
    expect(html).not.toContain('nginx');
  });

  it('renders an essentially empty section for no headers at all', () => {
    const html = render({});
    expect(html).not.toContain('x-trace-id');
    expect(html).not.toContain('Show');
    expect(html).toContain('aria-label="Response headers"');
  });

  it('renders a single "show more" toggle for many non-trace headers, not one per header', () => {
    const html = render({ server: 'nginx', etag: 'abc', 'x-custom': '1' });
    expect(html).toContain('Show 3 more headers');
    expect((html.match(/Show \d+ more headers/g) ?? []).length).toBe(1);
  });
});
