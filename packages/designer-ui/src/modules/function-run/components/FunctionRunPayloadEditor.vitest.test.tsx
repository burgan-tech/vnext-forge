import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Monaco does not run under this test setup (no jsdom); the JSON editor is
// rendered by CopyableJsonBlock's sibling export.
vi.mock('../../quick-run/components/CopyableJsonBlock', () => ({
  JsonEditorWithCopy: () => null,
  CopyableJsonBlock: () => null,
}));

const { FunctionRunPayloadEditor } = await import('./FunctionRunPayloadEditor.js');

const base = {
  contentType: 'json' as const,
  onContentTypeChange: () => {},
  value: {},
  onChange: () => {},
  schema: null,
  verb: 'POST' as const,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunPayloadEditor, { ...base, ...over } as never));

describe('FunctionRunPayloadEditor', () => {
  it('offers both content types the proxy allows', () => {
    const html = render();
    expect(html).toContain('application/json');
    expect(html).toContain('application/x-www-form-urlencoded');
  });

  it('renders key/value rows for form-urlencoded', () => {
    expect(render({ contentType: 'form', value: { a: '1' } })).toContain('a');
  });

  it('warns that GET and DELETE send no body, without disabling the editor', () => {
    for (const verb of ['GET', 'DELETE']) {
      const html = render({ verb });
      expect(html).toContain('query parameters');
    }
  });

  it('says nothing about query parameters for POST and PATCH', () => {
    for (const verb of ['POST', 'PATCH']) {
      expect(render({ verb })).not.toContain('query parameters');
    }
  });
});
