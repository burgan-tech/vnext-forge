import { describe, expect, it } from 'vitest';

import type { MonitorLevelData } from '../types';
import { buildComponentIndex, lookupComponent } from './componentIndex';
import { initialMonitorState, monitorReducer } from './monitorReducer';

const DATA = { loadedAt: 1 } as MonitorLevelData;
const T = { domain: 'd', workflowKey: 'w', instanceId: 'i' };
const ERR = { code: 'X', message: 'down' };

describe('monitorReducer', () => {
  it('goes ready on a successful load', () => {
    const s = monitorReducer(initialMonitorState(T), { type: 'load-done', result: { ok: true, data: DATA } });
    expect(s.load).toEqual({ kind: 'ready', data: DATA, refreshing: false, staleError: null });
  });

  it('keeps the data and flags it stale when a refresh fails', () => {
    const ready = monitorReducer(initialMonitorState(T), { type: 'load-done', result: { ok: true, data: DATA } });
    const refreshing = monitorReducer(ready, { type: 'refresh-start' });
    expect(refreshing.load).toMatchObject({ kind: 'ready', refreshing: true });
    const failed = monitorReducer(refreshing, { type: 'load-done', result: { ok: false, notFound: false, error: ERR } });
    expect(failed.load).toEqual({ kind: 'ready', data: DATA, refreshing: false, staleError: ERR });
  });

  it('maps a first-load failure to not-found or error', () => {
    expect(monitorReducer(initialMonitorState(T), { type: 'load-done', result: { ok: false, notFound: true, error: ERR } }).load).toEqual({ kind: 'not-found' });
    expect(monitorReducer(initialMonitorState(T), { type: 'load-done', result: { ok: false, notFound: false, error: ERR } }).load).toEqual({ kind: 'error', error: ERR });
  });

  it('clears the selection on a new target, keeps it on refresh', () => {
    const selected = monitorReducer(initialMonitorState(T), { type: 'select', selection: { kind: 'state', key: 'a' } });
    expect(monitorReducer(selected, { type: 'refresh-start' }).stack[0].selection).toEqual({ kind: 'state', key: 'a' });
    expect(monitorReducer(selected, { type: 'load-start' }).stack[0].selection).toBeNull();
  });

  it('drills into a child and pops back with each level keeping its selection', () => {
    const root = { domain: 'core', workflowKey: 'a', instanceId: '1' };
    const child = { domain: 'core', workflowKey: 'b', instanceId: '2' };
    let s = monitorReducer(initialMonitorState(root), { type: 'select', selection: { kind: 'state', key: 'x' } });
    s = monitorReducer(s, { type: 'drill', target: child });
    expect(s.stack.map((e) => e.target.instanceId)).toEqual(['1', '2']);
    expect(s.stack[1].selection).toBeNull();
    expect(s.load).toEqual({ kind: 'loading' });
    s = monitorReducer(s, { type: 'pop-to', index: 0 });
    expect(s.stack).toHaveLength(1);
    expect(s.stack[0].selection).toEqual({ kind: 'state', key: 'x' });
  });

  it('pauses and resumes', () => {
    expect(monitorReducer(initialMonitorState({ domain: 'd', workflowKey: 'w', instanceId: 'i' }), { type: 'paused', value: true }).paused).toBe(true);
  });

  it('toggles path-only', () => {
    expect(monitorReducer(initialMonitorState(T), { type: 'path-only', value: true }).pathOnly).toBe(true);
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
