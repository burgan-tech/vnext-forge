import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { normalizeIncident } from '../utils/incident';
import { IncidentSection } from './InstanceDashboard';

describe('IncidentSection', () => {
  it('shows a link-shape active incident without inventing entry fields', () => {
    const raw = { hasActiveIncident: true, active: { href: '/a' }, history: { href: '/h' } };
    const html = renderToStaticMarkup(createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw }));
    expect(html).toContain('This instance has an active incident');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('Current incident');
  });

  it('renders the embedded active entry from a legacy runtime', () => {
    const raw = {
      hasActiveIncident: true,
      totalCount: 1,
      active: {
        id: 'i1', createdAt: '2026-09-01T10:00:00Z', state: 'review', transition: 'approve', task: 'call-api',
        message: 'upstream failed', errorCode: 'E1', errorLayer: 'task', boundaryAction: null,
        boundaryLevel: null, traceId: 'tr', isResolved: false, resolvedAt: null, retryCount: 0,
      },
    };
    const html = renderToStaticMarkup(createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw }));
    expect(html).toContain('Current incident');
    expect(html).toContain('upstream failed');
  });
});
