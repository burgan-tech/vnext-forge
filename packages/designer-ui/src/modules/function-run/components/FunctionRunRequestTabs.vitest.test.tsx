import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunRequestTabs } from './FunctionRunRequestTabs.js';

const base = {
  activeTab: 'params' as const,
  onTabChange: () => undefined,
  bodyAvailable: true,
  paramsContent: 'PARAMS_MARKER',
  headersContent: 'HEADERS_MARKER',
  bodyContent: 'BODY_MARKER',
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunRequestTabs, { ...base, ...over } as never));

describe('FunctionRunRequestTabs', () => {
  it('always offers Params and Headers triggers', () => {
    const html = render();
    expect(html).toContain('>Params<');
    expect(html).toContain('>Headers<');
  });

  it('offers a Body trigger when the verb carries a body', () => {
    expect(render({ bodyAvailable: true })).toContain('>Body<');
  });

  it('does not render a Body trigger at all — not merely disabled — when the verb carries none', () => {
    const html = render({ bodyAvailable: false, activeTab: 'params' });
    expect(html).not.toContain('>Body<');
    // Radix does not render inactive tab content at all (verified against
    // this package's own harness), so the Body pane's own marker must be
    // absent too — not just its trigger.
    expect(html).not.toContain('BODY_MARKER');
  });

  it('renders only the active tab\'s content — Radix does not mount inactive panes', () => {
    const html = render({ activeTab: 'params' });
    expect(html).toContain('PARAMS_MARKER');
    expect(html).not.toContain('HEADERS_MARKER');
    expect(html).not.toContain('BODY_MARKER');
  });

  it('switches which content is mounted when activeTab changes', () => {
    const html = render({ activeTab: 'headers' });
    expect(html).toContain('HEADERS_MARKER');
    expect(html).not.toContain('PARAMS_MARKER');
  });

  it('mounts the Body content when it is the active tab and available', () => {
    const html = render({ activeTab: 'body', bodyAvailable: true });
    expect(html).toContain('BODY_MARKER');
  });

  it('marks the active trigger for assistive technology', () => {
    const html = render({ activeTab: 'headers' });
    // Anchored to the Headers trigger's own markup, not a bare count — the
    // Params/Body triggers must be present too, just not selected.
    const triggers = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
    const headersTrigger = triggers.find((t) => t.includes('>Headers<'));
    const paramsTrigger = triggers.find((t) => t.includes('>Params<'));
    expect(headersTrigger).toContain('aria-selected="true"');
    expect(paramsTrigger).toContain('aria-selected="false"');
  });
});
