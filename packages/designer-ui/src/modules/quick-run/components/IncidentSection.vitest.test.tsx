import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { IncidentEntry } from '../QuickRunApi';
import { normalizeIncident } from '../utils/incident';

// `CopyableJsonBlock` mounts Monaco, which the SSR-only harness cannot load.
vi.mock('./CopyableJsonBlock', () => ({
  CopyableJsonBlock: ({ value }: { value: unknown }) => createElement('pre', null, JSON.stringify(value)),
}));

const {
  IncidentSection,
  IncidentAlert,
  IncidentEntryCard,
  IncidentBadge,
  appendIncidentPage,
  excludeCurrentIncident,
  EMPTY_INCIDENT_HISTORY,
} =
  await import('./IncidentSection.js');

const LINK_SHAPE = { hasActiveIncident: true, active: { href: '/a' }, history: { href: '/h' } };

const ENTRY: IncidentEntry = {
  id: 'i1', createdAt: '2026-09-01T10:00:00Z', state: 'review', transition: 'approve', task: null,
  message: 'upstream failed', errorCode: 'Task:Http:Failed', errorLayer: 'Task', statusCode: 503,
  boundaryAction: null, boundaryLevel: null, traceId: 'tr', isResolved: false, resolvedAt: null, retryCount: 0,
};

const loaders = {
  loadActive: () => Promise.resolve({ success: true as const, data: { incident: null } }),
  loadHistory: () =>
    Promise.resolve({
      success: true as const,
      data: { hasActiveIncident: true, items: [], page: 1, pageSize: 20, hasNext: false },
    }),
};

describe('IncidentSection', () => {
  it('shows a link-shape active incident without inventing entry fields', () => {
    const html = renderToStaticMarkup(
      createElement(IncidentSection, { incident: normalizeIncident(LINK_SHAPE)!, raw: LINK_SHAPE }),
    );
    expect(html).toContain('This instance has an active incident');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toContain('Current incident');
  });

  it('offers lazy loading of the active incident and the history when loaders exist', () => {
    const html = renderToStaticMarkup(
      createElement(IncidentSection, { incident: normalizeIncident(LINK_SHAPE)!, raw: LINK_SHAPE, loaders }),
    );
    expect(html).toContain('Show active incident</button>');
    expect(html).toContain('Past incidents</button>');
  });

  it('renders the embedded active entry from a legacy runtime', () => {
    const raw = { hasActiveIncident: true, totalCount: 1, active: { ...ENTRY, task: 'call-api' } };
    const html = renderToStaticMarkup(
      createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw, loaders }),
    );
    expect(html).toContain('Current incident');
    expect(html).toContain('upstream failed');
    expect(html).not.toContain('Show active incident');
  });

  it('keeps the current incident out of the past incidents list', () => {
    const older: IncidentEntry = { ...ENTRY, id: 'i0', message: 'older failure', isResolved: true, resolvedAt: '2026-08-31T10:00:00Z' };
    const raw = { hasActiveIncident: true, totalCount: 2, active: ENTRY, history: [ENTRY, older] };
    const html = renderToStaticMarkup(createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw: {}, loaders }));
    expect(html.match(/upstream failed/g)).toHaveLength(1);
    expect(html).toContain('older failure');
  });

  it('says there are no past incidents when the history holds only the current one', () => {
    const raw = { hasActiveIncident: true, totalCount: 1, active: ENTRY, history: [ENTRY] };
    const html = renderToStaticMarkup(createElement(IncidentSection, { incident: normalizeIncident(raw)!, raw: {}, loaders }));
    expect(html.match(/upstream failed/g)).toHaveLength(1);
    expect(html).toContain('No past incidents.');
  });
});

describe('excludeCurrentIncident', () => {
  it('drops the entry matching the current incident id', () => {
    const older = { ...ENTRY, id: 'i0' };
    expect(excludeCurrentIncident([ENTRY, older], 'i1')).toEqual([older]);
  });

  it('returns the list unchanged without a current incident', () => {
    const list = [ENTRY];
    expect(excludeCurrentIncident(list, undefined)).toBe(list);
  });
});

describe('IncidentEntryCard', () => {
  it('shows the HTTP status code and a dash for missing fields', () => {
    const html = renderToStaticMarkup(createElement(IncidentEntryCard, { entry: ENTRY }));
    expect(html).toContain('503');
    expect(html).toContain('—');
  });
});

describe('IncidentAlert', () => {
  it('shows the strip collapsed by default', () => {
    const html = renderToStaticMarkup(
      createElement(IncidentAlert, { incident: normalizeIncident(LINK_SHAPE)!, raw: LINK_SHAPE, loaders }),
    );
    expect(html).toContain('This instance has an active incident.');
    expect(html).toContain('Show details');
    expect(html).not.toContain('Show active incident');
  });
});

describe('IncidentBadge', () => {
  it('is labelled for assistive tech', () => {
    expect(renderToStaticMarkup(createElement(IncidentBadge, {}))).toContain('aria-label="Active incident"');
  });
});

describe('appendIncidentPage', () => {
  it('appends new rows once and tracks paging', () => {
    const first = appendIncidentPage(EMPTY_INCIDENT_HISTORY, {
      hasActiveIncident: true, items: [ENTRY], page: 1, pageSize: 1, hasNext: true,
    });
    const second = appendIncidentPage(first, {
      hasActiveIncident: true, items: [ENTRY, { ...ENTRY, id: 'i2' }], page: 2, pageSize: 1, hasNext: false,
    });
    expect(second.items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(second.page).toBe(2);
    expect(second.hasNext).toBe(false);
  });
});
