import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./MonitorCanvas', () => ({ MonitorCanvas: () => h('div', { 'data-testid': 'canvas' }, 'canvas') }));

import { normalizeDefinition } from '../../canvas-interaction/readonly/normalize';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import type { MonitorLevelData } from '../types';
import { InstanceTab } from './InstanceTab';
import { MonitorInspector } from './MonitorInspector';
import { MonitorShellView } from './MonitorShell';
import { PathTimeline } from './PathTimeline';

const noop = vi.fn();
const row = (i: number, fromState: string, transitionId: string, toState: string): HistoryTransition => ({
  id: `h${i}`, transitionId, fromState, toState, startedAt: `2026-10-06T10:00:0${i}Z`, triggerType: 'manual', createdAt: 'x',
});
const HISTORY = [row(1, '$start', 'start', 'init'), row(2, 'init', 'submit', 'review'), row(3, 'review', 'reject', 'init'), row(4, 'init', 'submit', 'review')];
const VM = normalizeDefinition({
  key: 'loan',
  version: '1.2.0',
  attributes: {
    states: [
      { key: 'init', stateType: 1, transitions: [{ key: 'submit', target: 'review', labels: [{ language: 'en-US', label: 'Submit' }] }] },
      { key: 'review', stateType: 2, transitions: [{ key: 'reject', target: 'init' }] },
    ],
  },
});
const INSTANCE = {
  id: 'i1', key: 'order-4711', flow: 'loan', domain: 'core', flowVersion: '1.1.0-pkg.1.0.0+core', tags: ['vip'],
  metadata: { currentState: 'review', effectiveState: 'kyc-sub', status: 'A', createdAt: '2026-10-06T10:00:00Z', createdBy: 'tester' },
} as MonitorLevelData['instance'];
const DATA: MonitorLevelData = {
  instance: INSTANCE, history: HISTORY, loadedAt: 1, tasks: [], activeIncident: null, correlation: null,
  definition: { source: 'local', vm: VM, diagram: { nodePos: {} }, localVersion: '1.2.0' },
};
const TARGET = { domain: 'core', workflowKey: 'loan', instanceId: 'i1', environmentName: 'Local' };

describe('PathTimeline', () => {
  it('lists the path in order with labels', () => {
    const html = renderToStaticMarkup(h(PathTimeline, { history: HISTORY, vm: VM, selectedKey: 'submit', onSelect: noop }));
    expect(html).toContain('4 transitions');
    expect(html).toContain('Submit');
    expect(html).toContain('aria-pressed="true"');
  });
  it('says when nothing happened yet', () => {
    expect(renderToStaticMarkup(h(PathTimeline, { history: [], vm: VM, selectedKey: null, onSelect: noop }))).toContain('No transitions yet');
  });
});

describe('MonitorInspector', () => {
  it('prompts for a selection', () => {
    expect(renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: 'review', selection: null, onClose: noop }))).toContain('Select a state or transition');
  });
  it('shows a state with its visit summary', () => {
    const html = renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: 'review', selection: { kind: 'state', key: 'review' }, onClose: noop }));
    expect(html).toContain('Visited 2× · now here');
  });
  it('shows a transition with its firing count', () => {
    const html = renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: 'review', selection: { kind: 'transition', key: 'submit' }, onClose: noop }));
    expect(html).toContain('Fired 2×');
  });
  it('explains a key missing from the definition', () => {
    const html = renderToStaticMarkup(h(MonitorInspector, { vm: VM, history: HISTORY, currentState: null, selection: { kind: 'state', key: 'ghost' }, onClose: noop }));
    expect(html).toContain('not in the local definition');
  });
});

describe('InstanceTab', () => {
  it('shows identity, drift and the subflow note', () => {
    const html = renderToStaticMarkup(h(InstanceTab, { instance: INSTANCE, localVersion: '1.2.0', environmentName: 'Local' }));
    for (const text of ['order-4711', 'i1', 'core/loan', '1.1.0', 'local 1.2.0', 'inside a subflow', 'vip', 'tester', 'Local']) {
      expect(html).toContain(text);
    }
  });
});

describe('empty business key', () => {
  const NOKEY = { ...INSTANCE, id: 'abcdef12-3456-7890', key: '' } as MonitorLevelData['instance'];
  it('InstanceTab shows a dash in the Key row', () => {
    const html = renderToStaticMarkup(h(InstanceTab, { instance: NOKEY }));
    expect(html).toMatch(/Key[\s\S]{0,200}—/);
  });
  it('the shell header falls back to the short id', () => {
    const html = renderToStaticMarkup(h(MonitorShellView, {
      target: TARGET, selection: null, pathOnly: false, onRefresh: noop, onSelect: noop, onPathOnly: noop, links: {},
      load: { kind: 'ready', data: { ...DATA, instance: NOKEY }, refreshing: false, staleError: null },
    }));
    expect(html).toContain('<span class="font-mono">abcdef12</span>');
  });
});

describe('MonitorShellView', () => {
  const base = { target: TARGET, selection: null, pathOnly: false, onRefresh: noop, onSelect: noop, onPathOnly: noop, links: {} };
  it('shows loading', () => {
    expect(renderToStaticMarkup(h(MonitorShellView, { ...base, load: { kind: 'loading' } }))).toContain('Loading instance');
  });
  it('shows not found with the environment', () => {
    expect(renderToStaticMarkup(h(MonitorShellView, { ...base, load: { kind: 'not-found' } }))).toContain('Instance not found in Local');
  });
  it('shows a load error', () => {
    expect(renderToStaticMarkup(h(MonitorShellView, { ...base, load: { kind: 'error', error: { code: 'X', message: 'Runtime down' } } }))).toContain('Runtime down');
  });
  it('renders the ready layout with drift, stale and history-only notices', () => {
    const html = renderToStaticMarkup(h(MonitorShellView, {
      ...base,
      load: { kind: 'ready', data: { ...DATA, definition: { ...DATA.definition } }, refreshing: false, staleError: { code: 'X', message: 'down' } },
    }));
    for (const text of ['order-4711', 'canvas', 'Local definition 1.2.0', 'instance 1.1.0', 'Stale', 'Inspector', 'Instance', 'Path only']) {
      expect(html).toContain(text);
    }
    const historyOnly = renderToStaticMarkup(h(MonitorShellView, {
      ...base,
      load: { kind: 'ready', data: { ...DATA, definition: { ...DATA.definition, source: 'history', localVersion: undefined } }, refreshing: false, staleError: null },
    }));
    expect(historyOnly).toContain('Local definition not found');
  });
});
