import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { StateResponse } from '../types/quickrun.types';

// `CopyableJsonBlock` mounts Monaco, which needs a DOM this package's
// SSR-only harness does not have. Rendering the value as plain text instead
// keeps the assertions about *what is passed to it* meaningful.
vi.mock('./CopyableJsonBlock', () => ({
  CopyableJsonBlock: ({ value }: { value: unknown }) =>
    createElement('pre', null, JSON.stringify(value)),
}));

const { RawTabContent } = await import('./ContextPanel.js');

const BODY: StateResponse = {
  state: 'AwaitingApproval',
  status: 'B',
  transitions: [{ name: 'approve', href: '/approve' }],
  functions: { hasFunctions: true, href: '/core/workflows/w/instances/i/functions/catalog' },
  responseHeaders: { 'x-trace-id': 'trace-1' },
};

describe('ContextPanel — Raw tab', () => {
  it('says nothing has arrived yet rather than rendering an empty block', () => {
    const html = renderToStaticMarkup(
      createElement(RawTabContent, { response: null, receivedAt: null, notModified: false }),
    );
    expect(html).toContain('No state response yet');
  });

  it('renders the whole response body, not just the fields the dashboard maps', () => {
    const html = renderToStaticMarkup(
      createElement(RawTabContent, { response: BODY, receivedAt: 0, notModified: false }),
    );
    // Every field is passed through — including ones with no dashboard
    // surface of their own, which is the point of the tab.
    expect(html).toContain('AwaitingApproval');
    expect(html).toContain('hasFunctions');
    expect(html).toContain('x-trace-id');
  });

  it('explains a 304 instead of blanking, since the body shown is the previous one', () => {
    const html = renderToStaticMarkup(
      createElement(RawTabContent, { response: BODY, receivedAt: 0, notModified: true }),
    );
    expect(html).toContain('304 Not Modified');
    expect(html).toContain('AwaitingApproval');
  });

  it('omits the 304 note on a fresh body', () => {
    const html = renderToStaticMarkup(
      createElement(RawTabContent, { response: BODY, receivedAt: 0, notModified: false }),
    );
    expect(html).not.toContain('304 Not Modified');
  });
});
