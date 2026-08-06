import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunHeadersTab } from './FunctionRunHeadersTab.js';

const base = {
  toolWideHeaders: {},
  toolWideHeadersHostOwned: false,
  sessionHeaders: {},
  onSessionHeadersChange: () => undefined,
  onEditToolWideHeaders: () => undefined,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunHeadersTab, { ...base, ...over } as never));

describe('FunctionRunHeadersTab — Forge-wide layer', () => {
  it('shows a read-only row for each Forge-wide header, naming their shared origin', () => {
    const html = render({ toolWideHeaders: { Authorization: 'Bearer tool-token' } });
    expect(html).toContain('value="Authorization"');
    expect(html).toContain('value="Bearer tool-token"');
    expect(html).toContain('Shared with Quick Run');
  });

  it('renders the Forge-wide row read-only — no remove control for it', () => {
    const html = render({ toolWideHeaders: { Authorization: 'Bearer tool-token' }, sessionHeaders: {} });
    // Only the per-run KV editor may offer removal; with no session headers
    // present, any "Remove row" control in the output can only have come
    // from the (wrongly) editable Forge-wide list.
    expect(html).not.toContain('Remove row');
  });

  it('shows an empty-state message instead of a table when there are no Forge-wide headers', () => {
    const html = render({ toolWideHeaders: {} });
    expect(html).toContain('No Forge-wide headers configured.');
  });

  it('offers a control to edit the Forge-wide set when it is not host-owned', () => {
    expect(render({ toolWideHeadersHostOwned: false })).toContain('>Edit<');
  });
});

describe('FunctionRunHeadersTab — host-owned Forge-wide set (extension)', () => {
  it('hides the Edit control when the host owns the Forge-wide set', () => {
    // A save through the dialog would appear to work and then be silently
    // overwritten the next time the panel opens — see
    // `areToolHeadersHostOwned`'s own doc comment. Offering the control
    // anyway would be an editor that discards edits, which is worse than no
    // editor at all.
    const html = render({ toolWideHeadersHostOwned: true });
    expect(html).not.toContain('>Edit<');
  });

  it('names where to actually change the Forge-wide set instead', () => {
    const html = render({ toolWideHeadersHostOwned: true });
    expect(html).toContain('vNext Forge Tools');
    expect(html).toContain('Settings');
  });

  it('still shows the Forge-wide headers read-only when host-owned', () => {
    const html = render({ toolWideHeadersHostOwned: true, toolWideHeaders: { Authorization: 'Bearer tool-token' } });
    expect(html).toContain('value="Authorization"');
    expect(html).not.toContain('Remove row');
  });

  it('does not mention the Forge Tools location when not host-owned', () => {
    const html = render({ toolWideHeadersHostOwned: false });
    expect(html).not.toContain('vNext Forge Tools');
  });
});

describe('FunctionRunHeadersTab — per-run layer', () => {
  it('shows an editable row for each per-run header', () => {
    const html = render({ sessionHeaders: { 'X-Trace': '1' } });
    expect(html).toContain('value="X-Trace"');
    expect(html).toContain('value="1"');
  });

  it('offers Add and Remove controls for the per-run set', () => {
    const html = render({ sessionHeaders: { 'X-Trace': '1' } });
    expect(html).toContain('Add header');
    expect(html).toContain('Remove row');
  });
});

describe('FunctionRunHeadersTab — shadowing (Fix: per-run overrides Forge-wide)', () => {
  it('flags a per-run header that shadows a Forge-wide one of the same name', () => {
    const html = render({
      toolWideHeaders: { Authorization: 'tool-wide' },
      sessionHeaders: { Authorization: 'session' },
    });
    expect(html).toContain('overrides the Forge-wide header');
    expect(html).toContain('Authorization');
  });

  it('does not show a shadow warning when the two sets do not overlap', () => {
    const html = render({
      toolWideHeaders: { Authorization: 'tool-wide' },
      sessionHeaders: { 'X-Trace': '1' },
    });
    expect(html).not.toContain('overrides the Forge-wide header');
  });

  it('does not flag differently-cased header names as shadowing each other', () => {
    // Matches the case-sensitive object-spread merge `mergeQuickRunHeaders`
    // actually performs — see `computeShadowedHeaderKeys`'s own test.
    const html = render({
      toolWideHeaders: { Authorization: 'tool-wide' },
      sessionHeaders: { authorization: 'session' },
    });
    expect(html).not.toContain('overrides the Forge-wide header');
  });

  it('names every shadowed header when more than one collides', () => {
    const html = render({
      toolWideHeaders: { Authorization: 'a', 'X-Trace': 'b' },
      sessionHeaders: { Authorization: 'a2', 'X-Trace': 'b2' },
    });
    expect(html).toContain('override Forge-wide headers');
    expect(html).toContain('Authorization');
    expect(html).toContain('X-Trace');
  });
});
