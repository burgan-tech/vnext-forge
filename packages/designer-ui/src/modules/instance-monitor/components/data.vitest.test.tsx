import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { diffJson } from '../model/jsonDiff';
import { DataDiffView } from './DataDiffView';
import { DataTab } from './DataTab';
import { TransitionExecution, dataChangeTab } from './TransitionExecution';

const row = (n: number, enteredAt: string, data: unknown) => ({ id: `r${n}`, version: `1.0.${n}`, versionNo: n, enteredAt, eTag: `e${n}`, isLatest: n === 3, data }) as never;
const firing = { id: 'f1', transitionId: 'submit', fromState: 'init', toState: 'review', startedAt: '2026-10-06T10:00:00Z', finishedAt: '2026-10-06T10:00:10Z', triggerType: 'manual', createdAt: 'x' } as never;

describe('DataDiffView', () => {
  it('renders added, removed and changed fields', () => {
    const html = renderToStaticMarkup(h(DataDiffView, { diff: diffJson({ a: 1, gone: true, keep: 1 }, { a: 2, b: { e: 5 }, keep: 1 }) }));
    expect(html).toContain('b.e');
    expect(html).toContain('gone');
    expect(html).toContain('~');
    expect(html).toContain('−');
    expect(html).toContain('line-through');
    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
    expect(html).toContain('1 field unchanged');
  });
  it('says nothing changed', () => {
    expect(renderToStaticMarkup(h(DataDiffView, { diff: diffJson({ a: 1 }, { a: 1 }) }))).toContain('No differences. 1 field unchanged.');
  });
});

describe('DataTab', () => {
  const rows = [row(3, '2026-10-06T11:00:00Z', { a: 3 }), row(2, '2026-10-06T10:00:05Z', { a: 2 }), row(1, '2026-10-06T09:00:00Z', { a: 1 })];
  const base = { history: [firing], rows, hasNext: true, error: null, onLoadMore: () => undefined, current: { a: 3 } };
  it('lists versions with attribution and compare', () => {
    const html = renderToStaticMarkup(h(DataTab, { ...base, state: 'ready' }));
    expect(html).toContain('v1.0.3 #3');
    expect(html).toContain('after submit');
    expect(html).toContain('Other write');
    expect(html).toContain('fields changed');
    expect(html).toContain('Compare');
    expect(html).toContain('Load more');
  });
  it('explains an older runtime', () => {
    expect(renderToStaticMarkup(h(DataTab, { ...base, rows: [], state: 'unavailable' }))).toContain('Data history needs a newer runtime.');
  });
  it('reports a failed current load', () => {
    expect(renderToStaticMarkup(h(DataTab, { ...base, state: 'ready', current: undefined, currentFailed: true }))).toContain('Current data could not be loaded.');
  });
});

describe('unloaded predecessor', () => {
  const rows = [row(3, '2026-10-06T11:00:00Z', { a: 3 }), row(2, '2026-10-06T10:00:05Z', { a: 2 })];
  const base = { history: [firing], rows, state: 'ready' as const, error: null, onLoadMore: () => undefined, current: {} };
  it('does not claim a change count for the oldest row while more pages exist', () => {
    expect(renderToStaticMarkup(h(DataTab, { ...base, hasNext: true }))).toContain('Previous version not loaded');
  });
  it('treats the oldest row as the first write once everything is loaded', () => {
    expect(renderToStaticMarkup(h(DataTab, { ...base, hasNext: false }))).not.toContain('Previous version not loaded');
  });
  it('shows a load error inline and keeps the rows', () => {
    const html = renderToStaticMarkup(h(DataTab, { ...base, hasNext: true, error: { code: 'X', message: 'boom' } }));
    expect(html).toContain('#3');
    expect(html).toContain('Data history request failed');
  });
  it('the Data change tab notes a missing predecessor', () => {
    const html = renderToStaticMarkup(h(TransitionExecution, { firings: [firing], tasks: [], dataRowsByFiring: new Map([['f1', [rows[1]!]]]), allRows: rows, dataHasNext: true }));
    expect(html).toContain('Data change');
  });
});

describe('TransitionExecution data change', () => {
  it('adds a Data change tab for a firing with attributed rows', () => {
    const rows = [row(2, '2026-10-06T10:00:05Z', { a: 2 }), row(1, '2026-10-06T09:00:00Z', { a: 1 })];
    const html = renderToStaticMarkup(h(TransitionExecution, { firings: [firing], tasks: [], dataRowsByFiring: new Map([['f1', [rows[0]!]]]), allRows: rows }));
    expect(html).toContain('Data change');
  });
  it('has no tab without rows', () => {
    expect(renderToStaticMarkup(h(TransitionExecution, { firings: [firing], tasks: [] }))).not.toContain('Data change');
  });
});

describe('DataTab compare ordering and labels', () => {
  const vrow = (id: string, version: string, versionNo: number, enteredAt: string, data: unknown) =>
    ({ id, version, versionNo, enteredAt, eTag: id, isLatest: false, data }) as never;
  const rows = [
    vrow('n', '1.1.0', 1, '2026-10-06T12:00:00Z', { a: 'new' }),
    vrow('o', '1.0.0', 4, '2026-10-06T10:00:00Z', { a: 'old' }),
  ];
  it('labels rows with version line and number', () => {
    const html = renderToStaticMarkup(h(DataTab, { history: [], rows, state: 'ready', hasNext: false, error: null, onLoadMore: () => undefined }));
    expect(html).toContain('v1.1.0 #1');
    expect(html).toContain('v1.0.0 #4');
  });
  it('shows the current ETag', () => {
    const html = renderToStaticMarkup(h(DataTab, { history: [], rows, state: 'ready', hasNext: false, error: null, onLoadMore: () => undefined, current: {}, currentETag: 'abc123' }));
    expect(html).toContain('ETag');
    expect(html).toContain('abc123');
  });
  it('labels the oldest row of a fully loaded history as the initial version', () => {
    const html = renderToStaticMarkup(h(DataTab, { history: [], rows, state: 'ready', hasNext: false, error: null, onLoadMore: () => undefined }));
    expect(html).toContain('Initial version');
  });
});

describe('Data change tab for an unloaded page', () => {
  const loaded = [row(3, '2026-10-06T11:00:00Z', { a: 3 }), row(2, '2026-10-06T10:30:00Z', { a: 2 })];
  const early = { ...(firing as object), id: 'early', startedAt: '2026-10-06T10:00:00Z', finishedAt: '2026-10-06T10:00:10Z' } as never;
  const render = (tabs: ReturnType<typeof dataChangeTab>) => renderToStaticMarkup(h('div', null, tabs[0]?.render()));
  it('notes that the firing data is not loaded', () => {
    const tabs = dataChangeTab('early', early, undefined, loaded, true);
    expect(tabs).toHaveLength(1);
    expect(render(tabs)).toContain('Data for this firing is not loaded — load more in the Data tab.');
  });
  it('adds no tab once every page is loaded', () => {
    expect(dataChangeTab('early', early, undefined, loaded, false)).toHaveLength(0);
  });
  it('adds no tab for a firing inside the loaded range', () => {
    const inside = { ...(firing as object), id: 'inside', startedAt: '2026-10-06T10:45:00Z', finishedAt: '2026-10-06T10:45:01Z' } as never;
    expect(dataChangeTab('inside', inside, undefined, loaded, true)).toHaveLength(0);
  });
});
