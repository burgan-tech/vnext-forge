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
    const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
    expect(buttons.some((b) => b.includes('approve'))).toBe(true);
    expect(buttons.some((b) => b.includes('reminder'))).toBe(false);
    expect(html).toContain('reminder');
    expect(html).toContain('Scheduled');
  });
});
