import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunParamsTab } from './FunctionRunParamsTab.js';

const base = {
  queryString: '',
  onQueryStringChange: () => undefined,
  view: 'table' as const,
  onViewChange: () => undefined,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunParamsTab, { ...base, ...over } as never));

describe('FunctionRunParamsTab — table view', () => {
  it('shows one KV row per query parameter on first render', () => {
    const html = render({ queryString: 'a=1&b=2' });
    expect(html).toContain('value="a"');
    expect(html).toContain('value="1"');
    expect(html).toContain('value="b"');
    expect(html).toContain('value="2"');
  });

  it('offers an Add-param control and no rows for an empty query string', () => {
    const html = render({ queryString: '' });
    expect(html).toContain('Add param');
    expect(html).not.toContain('placeholder="Param"');
    // No rows means no removable KV row inputs at all — asserted via the
    // absence of the row's own placeholder rather than counting inputs,
    // which would also match the raw-mode single field in a future refactor.
  });

  it('decodes a percent-encoded query string into readable row values', () => {
    const html = render({ queryString: 'name=a%20b' });
    expect(html).toContain('value="a b"');
  });

  it('does not render the raw single-field input while in table view', () => {
    const html = render({ queryString: 'a=1', view: 'table' });
    expect(html).not.toContain('aria-label="Query string"');
  });
});

describe('FunctionRunParamsTab — raw view', () => {
  it('renders a single field bound directly to the raw query string', () => {
    const html = render({ queryString: 'a=1&b=2', view: 'raw' });
    expect(html).toContain('aria-label="Query string"');
    expect(html).toContain('value="a=1&amp;b=2"');
  });

  it('does not render the KV table or its Add control while in raw view', () => {
    const html = render({ queryString: 'a=1', view: 'raw' });
    expect(html).not.toContain('Add param');
  });
});

describe('FunctionRunParamsTab — view toggle', () => {
  it('marks the active view for assistive technology', () => {
    const tableHtml = render({ view: 'table' });
    expect(tableHtml).toMatch(/>Table<\/button>/);
    const triggers = tableHtml.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
    const tableTrigger = triggers.find((t) => t.includes('>Table<'));
    const rawTrigger = triggers.find((t) => t.includes('>Raw<'));
    expect(tableTrigger).toContain('aria-selected="true"');
    expect(rawTrigger).toContain('aria-selected="false"');
  });
});
