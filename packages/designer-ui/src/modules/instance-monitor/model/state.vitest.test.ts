import { describe, expect, it } from 'vitest';

import type { MonitorLevelData } from '../types';
import { buildComponentIndex, lookupComponent } from './componentIndex';
import { initialMonitorState, monitorReducer } from './monitorReducer';

const DATA = { loadedAt: 1 } as MonitorLevelData;
const ERR = { code: 'X', message: 'down' };

describe('monitorReducer', () => {
  it('goes ready on a successful load', () => {
    const s = monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: true, data: DATA } });
    expect(s.load).toEqual({ kind: 'ready', data: DATA, refreshing: false, staleError: null });
  });

  it('keeps the data and flags it stale when a refresh fails', () => {
    const ready = monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: true, data: DATA } });
    const refreshing = monitorReducer(ready, { type: 'refresh-start' });
    expect(refreshing.load).toMatchObject({ kind: 'ready', refreshing: true });
    const failed = monitorReducer(refreshing, { type: 'load-done', result: { ok: false, notFound: false, error: ERR } });
    expect(failed.load).toEqual({ kind: 'ready', data: DATA, refreshing: false, staleError: ERR });
  });

  it('maps a first-load failure to not-found or error', () => {
    expect(monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: false, notFound: true, error: ERR } }).load).toEqual({ kind: 'not-found' });
    expect(monitorReducer(initialMonitorState, { type: 'load-done', result: { ok: false, notFound: false, error: ERR } }).load).toEqual({ kind: 'error', error: ERR });
  });

  it('clears the selection on a new target, keeps it on refresh', () => {
    const selected = monitorReducer(initialMonitorState, { type: 'select', selection: { kind: 'state', key: 'a' } });
    expect(monitorReducer(selected, { type: 'refresh-start' }).selection).toEqual({ kind: 'state', key: 'a' });
    expect(monitorReducer(selected, { type: 'load-start' }).selection).toBeNull();
  });

  it('toggles path-only', () => {
    expect(monitorReducer(initialMonitorState, { type: 'path-only', value: true }).pathOnly).toBe(true);
  });
});

describe('componentIndex', () => {
  const index = buildComponentIndex([
    ['views', [{ key: 'approve-view', path: '/ws/Views/approve-view.json', flow: 'sys-views' }]],
    ['tasks', []],
  ]);
  it('finds a file by category and key', () => {
    expect(lookupComponent(index, 'views', 'approve-view')).toBe('/ws/Views/approve-view.json');
  });
  it('says null for a loaded category without the key, undefined for an unloaded one', () => {
    expect(lookupComponent(index, 'tasks', 'missing')).toBeNull();
    expect(lookupComponent(index, 'schemas', 'any')).toBeUndefined();
  });
});
