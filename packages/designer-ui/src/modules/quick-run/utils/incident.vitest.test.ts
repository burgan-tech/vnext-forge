import { describe, expect, it } from 'vitest';
import { normalizeIncident } from './incident';

const ENTRY = {
  id: 'i1', createdAt: '2026-09-20T10:00:00Z', state: 's', transition: 't', task: 'k',
  message: 'boom', errorCode: 'E1', errorLayer: 'task', boundaryAction: null, boundaryLevel: null,
  traceId: 'tr', isResolved: false, resolvedAt: null, retryCount: 0,
};

describe('normalizeIncident', () => {
  it('returns null for missing input', () => {
    expect(normalizeIncident(undefined)).toBeNull();
    expect(normalizeIncident('x')).toBeNull();
  });

  it('reads the link shape (runtime >= 2026-09-07)', () => {
    expect(
      normalizeIncident({
        hasActiveIncident: true,
        active: { href: '/core/workflows/w/instances/1/incidents/active' },
        history: { href: '/core/workflows/w/instances/1/incidents' },
      }),
    ).toEqual({
      hasActiveIncident: true,
      history: [],
      links: {
        active: '/core/workflows/w/instances/1/incidents/active',
        history: '/core/workflows/w/instances/1/incidents',
      },
    });
  });

  it('reads the legacy embedded shape', () => {
    const n = normalizeIncident({ hasActiveIncident: true, totalCount: 2, active: ENTRY, history: [ENTRY] });
    expect(n?.hasActiveIncident).toBe(true);
    expect(n?.active?.id).toBe('i1');
    expect(n?.history).toHaveLength(1);
    expect(n?.links).toBeUndefined();
  });

  it('treats a resolved legacy active entry as no active incident', () => {
    const n = normalizeIncident({ hasActiveIncident: true, active: { ...ENTRY, isResolved: true } });
    expect(n?.hasActiveIncident).toBe(false);
  });

  it('reads a link shape without an active incident', () => {
    expect(normalizeIncident({ hasActiveIncident: false, history: { href: '/h' } })).toEqual({
      hasActiveIncident: false,
      history: [],
      links: { history: '/h' },
    });
  });
});
