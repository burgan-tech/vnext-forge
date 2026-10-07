import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { IncidentsTab } from './IncidentsTab';

const noop = vi.fn();
const ENTRY = { id: 'in1', createdAt: '2026-10-06T10:00:00Z', state: 'review', transition: 'submit', task: 'notify', message: 'Gateway timeout', errorCode: 'Task:500', isResolved: false, retryCount: 1 } as never;

describe('IncidentsTab', () => {
  it('shows the active incident with show-on-canvas and a Quick Run link', () => {
    const html = renderToStaticMarkup(h(IncidentsTab, { active: ENTRY, onShowOnCanvas: noop, onOpenQuickRun: noop }));
    for (const t of ['Active incident', 'Gateway timeout', 'Show on canvas', 'Retry from Quick Run']) expect(html).toContain(t);
  });
  it('says when nothing is open', () => {
    expect(renderToStaticMarkup(h(IncidentsTab, { active: null, onShowOnCanvas: noop }))).toContain('No open incident');
  });
  it('offers the history only when loaders exist', () => {
    expect(renderToStaticMarkup(h(IncidentsTab, { active: null, onShowOnCanvas: noop }))).not.toContain('Load incident history');
    expect(
      renderToStaticMarkup(
        h(IncidentsTab, {
          active: null,
          onShowOnCanvas: noop,
          loaders: {
            loadActive: () => Promise.resolve({ success: true as const, data: { incident: null } }),
            loadHistory: () => Promise.resolve({ success: true as const, data: { hasActiveIncident: false, items: [], page: 1, pageSize: 20, hasNext: false } }),
          },
        }),
      ),
    ).toContain('Load incident history');
  });
});
