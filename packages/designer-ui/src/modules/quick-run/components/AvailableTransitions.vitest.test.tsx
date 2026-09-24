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
