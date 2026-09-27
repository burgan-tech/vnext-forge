import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AuthorizePanel, type AuthorizePanelProps } from './AuthorizePanel';

const render = (over: Partial<AuthorizePanelProps> = {}) =>
  renderToStaticMarkup(
    createElement(AuthorizePanel, {
      transitionKeys: ['approve', 'reject'],
      functionKeys: ['get-branches'],
      defaultRole: 'approver',
      onRun: () => Promise.resolve({ kind: 'verdict' as const, allowed: true, status: 200 }),
      checksEnabled: false,
      onChecksEnabledChange: () => undefined,
      ...over,
    }),
  );

describe('AuthorizePanel', () => {
  it('offers the four targets, the transitions, role and version', () => {
    const html = render();
    for (const text of ['Transition', 'Function', 'Instance visibility (queryRoles)', 'Acknowledge (ack)', 'approve', 'reject', 'Version', 'Run']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('value="approver"');
  });

  it('shows the opt-in toggle with the role', () => {
    const html = render();
    expect(html).toContain('Check permissions for role');
    expect(html).not.toMatch(/type="checkbox"[^>]*checked=""/);
    expect(render({ checksEnabled: true })).toMatch(/type="checkbox"[^>]*checked=""/);
  });

  it('shows the instance-visibility indicator when checked', () => {
    expect(render({ checksEnabled: true, visibility: { kind: 'verdict', allowed: false, status: 403 } })).toContain(
      'Instance hidden from this role',
    );
  });
});
