import { describe, expect, it, vi } from 'vitest';

import type { MonitorLoaders } from './loadMonitorLevel';
import { loadMonitorLevel, loadMonitorLevelSafe } from './loadMonitorLevel';

const INSTANCE = {
  id: 'i1', key: 'order-1', flow: 'loan', domain: 'core', flowVersion: '1.0.0',
  metadata: { currentState: 'review', effectiveState: 'review', status: 'A', createdAt: '2026-10-06T10:00:00Z' },
};
const HISTORY = { transitions: [{ id: 'h1', transitionId: 'start', fromState: '$start', toState: 'review', startedAt: 'x', triggerType: 'manual', createdAt: 'x' }] };
const WORKFLOW = { key: 'loan', version: '1.0.0', attributes: { states: [{ key: 'review', stateType: 2, transitions: [] }] } };

function loaders(over: Partial<MonitorLoaders> = {}): MonitorLoaders {
  return {
    getInstance: vi.fn(async () => ({ success: true, data: INSTANCE })) as unknown as MonitorLoaders['getInstance'],
    getHistory: vi.fn(async () => ({ success: true, data: HISTORY })) as unknown as MonitorLoaders['getHistory'],
    loadDefinition: vi.fn(async () => ({ success: true, data: { workflow: WORKFLOW, diagram: { nodePos: { review: { x: 1, y: 2 } } } } })) as unknown as MonitorLoaders['loadDefinition'],
    now: () => 42,
    ...over,
  };
}

const TARGET = { domain: 'core', workflowKey: 'loan', instanceId: 'i1', workflowFilePath: '/ws/Workflows/loan.json', runtimeUrl: 'http://localhost:4201' };

describe('loadMonitorLevel', () => {
  it('uses the local definition and its diagram', async () => {
    const l = loaders();
    const r = await loadMonitorLevel(TARGET, { 'x-a': '1' }, l);
    expect(r.ok && r.data.definition.source).toBe('local');
    expect(r.ok && r.data.definition.localVersion).toBe('1.0.0');
    expect(r.ok && r.data.definition.diagram).toEqual({ nodePos: { review: { x: 1, y: 2 } } });
    expect(l.loadDefinition).toHaveBeenCalledWith({ workflowFilePath: '/ws/Workflows/loan.json', diagramFilePath: '/ws/Workflows/.meta/loan.diagram.json' });
    expect(l.getInstance).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'i1', headers: { 'x-a': '1' }, runtimeUrl: 'http://localhost:4201' }));
    expect(r.ok && r.data.loadedAt).toBe(42);
  });

  it('falls back to the history-only graph when the local file cannot be read', async () => {
    const r = await loadMonitorLevel(TARGET, {}, loaders({
      loadDefinition: vi.fn(async () => ({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'nope', traceId: 't' } })) as unknown as MonitorLoaders['loadDefinition'],
    }));
    expect(r.ok && r.data.definition.source).toBe('history');
    expect(r.ok && r.data.definition.vm.states.map((s) => s.key)).toEqual(['review']);
  });

  it('skips the file read without a workflow path', async () => {
    const l = loaders();
    const r = await loadMonitorLevel({ ...TARGET, workflowFilePath: undefined }, {}, l);
    expect(l.loadDefinition).not.toHaveBeenCalled();
    expect(r.ok && r.data.definition.source).toBe('history');
  });

  it('reports a RUNTIME_NOT_FOUND instance (wire shape, no details) as not found', async () => {
    const r = await loadMonitorLevel(TARGET, {}, loaders({
      getInstance: vi.fn(async () => ({ success: false, error: { code: 'RUNTIME_NOT_FOUND', message: 'The runtime could not find the requested resource.', traceId: 't' } })) as unknown as MonitorLoaders['getInstance'],
    }));
    expect(r).toMatchObject({ ok: false, notFound: true });
  });

  it('falls back to details.httpStatus 404 as not found', async () => {
    const r = await loadMonitorLevel(TARGET, {}, loaders({
      getInstance: vi.fn(async () => ({ success: false, error: { code: 'RUNTIME_PROXY_ERROR', message: 'Not found', traceId: 't', details: { httpStatus: 404 } } })) as unknown as MonitorLoaders['getInstance'],
    }));
    expect(r).toMatchObject({ ok: false, notFound: true });
  });

  it('reports other failures as errors', async () => {
    const r = await loadMonitorLevel(TARGET, {}, loaders({
      getHistory: vi.fn(async () => ({ success: false, error: { code: 'RUNTIME_UNREACHABLE', message: 'down', traceId: 't' } })) as unknown as MonitorLoaders['getHistory'],
    }));
    expect(r).toMatchObject({ ok: false, notFound: false, error: { message: 'down' } });
  });
});

describe('loadMonitorLevelSafe', () => {
  it('turns a thrown loader into an error result instead of rejecting', async () => {
    const r = await loadMonitorLevelSafe(TARGET, {}, loaders({
      getInstance: vi.fn(async () => { throw new Error('boom'); }) as unknown as MonitorLoaders['getInstance'],
    }));
    expect(r).toMatchObject({ ok: false, notFound: false, error: { code: 'INTERNAL_UNEXPECTED', message: 'boom' } });
  });
  it('uses a generic message for a non-Error throw', async () => {
    const r = await loadMonitorLevelSafe(TARGET, {}, loaders({
      getInstance: vi.fn(async () => { throw 'x'; }) as unknown as MonitorLoaders['getInstance'],
    }));
    expect(r).toMatchObject({ ok: false, error: { message: 'Unexpected error while loading the instance.' } });
  });
});

