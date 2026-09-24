import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AvailableTransitions } from './AvailableTransitions';

const noop = () => undefined;

describe('AvailableTransitions — scheduled entries', () => {
  it('renders scheduled entries without a button', () => {
    const html = renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [
          { name: 'approve', href: '/t/approve', kind: 'stateTransition' },
          { name: 'reminder', href: '/t/reminder', kind: 'scheduled', executeAtUtc: '2026-09-30T12:00:00Z' },
        ],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: false,
        onManualClick: noop,
        disabled: false,
      }),
    );
    // Non-greedy match so a button with a nested child element (e.g. an
    // executeAtUtc <span>) is still captured as a single button segment,
    // rather than silently passing the old [^<]* content-only regex.
    const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    expect(buttons.some((b) => b.includes('approve'))).toBe(true);
    expect(buttons.some((b) => b.includes('reminder'))).toBe(false);
    // Belt-and-suspenders: only the 'approve' transition should render as a
    // button at all — the scheduled 'reminder' entry must not, even if it
    // wraps its text in nested markup.
    expect((html.match(/<button\b/g) ?? []).length).toBe(1);
    expect(html).toContain('reminder');
    expect(html).toContain('Scheduled');
  });

  it('renders a malformed executeAtUtc without an "Invalid Date" suffix', () => {
    const html = renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [
          { name: 'reminder', href: '/t/reminder', kind: 'scheduled', executeAtUtc: 'not-a-date' },
        ],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: false,
        onManualClick: noop,
        disabled: false,
      }),
    );
    expect(html).not.toContain('Invalid Date');
  });
});

describe('AvailableTransitions — locked while awaiting acknowledge', () => {
  it('disables every button and shows the reason', () => {
    const html = renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [{ name: 'approve', href: '/t/approve', kind: 'stateTransition' }],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: true,
        onManualClick: noop,
        disabled: false,
        lockedReason: 'Awaiting acknowledge',
      }),
    );
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.includes('disabled=""'))).toBe(true);
    expect(html).toContain('Awaiting acknowledge');
  });
});

describe('AvailableTransitions — scheduled countdown and annotations', () => {
  const NOW = Date.parse('2026-09-30T12:00:00Z');
  const renderScheduled = (executeAtUtc: string) =>
    renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [
          { name: 'reminder', href: '/t/r', kind: 'scheduled', executeAtUtc, annotations: { 'ui/priority': 'high' } },
        ],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: false,
        onManualClick: noop,
        disabled: false,
        nowMs: NOW,
      }),
    );

  it('counts down and shows annotation chips on a non-interactive entry', () => {
    const html = renderScheduled('2026-09-30T12:01:00Z');
    expect(html).toContain('in 1m 0s');
    expect(html).toContain('ui/priority');
    expect(html).toContain('aria-disabled="true"');
  });

  it('says Settling… once executeAtUtc has passed', () => {
    expect(renderScheduled('2026-09-30T11:00:00Z')).toContain('Settling…');
  });
});

describe('AvailableTransitions — permission badges', () => {
  it('marks allowed and denied transitions', () => {
    const html = renderToStaticMarkup(
      createElement(AvailableTransitions, {
        transitions: [
          { name: 'approve', href: '/a', kind: 'stateTransition' },
          { name: 'reject', href: '/r', kind: 'stateTransition' },
        ],
        sharedTransitions: [],
        flowLabels: null,
        onTransitionClick: noop,
        showManual: false,
        onManualClick: noop,
        disabled: false,
        permissions: {
          approve: { kind: 'verdict', allowed: true, status: 200 },
          reject: { kind: 'verdict', allowed: false, status: 403 },
        },
      }),
    );
    expect(html).toContain('aria-label="Allowed (HTTP 200)"');
    expect(html).toContain('aria-label="Denied (HTTP 403)"');
  });
});
