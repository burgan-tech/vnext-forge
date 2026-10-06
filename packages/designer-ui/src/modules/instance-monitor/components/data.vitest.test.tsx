import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { diffJson } from '../model/jsonDiff';
import { DataDiffView } from './DataDiffView';
import { DataTab } from './DataTab';
import { TransitionExecution } from './TransitionExecution';

const row = (n: number, enteredAt: string, data: unknown) => ({ id: `r${n}`, version: `v${n}`, versionNo: n, enteredAt, eTag: `e${n}`, isLatest: n === 3, data }) as never;
const firing = { id: 'f1', transitionId: 'submit', fromState: 'init', toState: 'review', startedAt: '2026-10-06T10:00:00Z', finishedAt: '2026-10-06T10:00:10Z', triggerType: 'manual', createdAt: 'x' } as never;

describe('DataDiffView', () => {
  it('renders added, removed and changed fields', () => {
    const html = renderToStaticMarkup(h(DataDiffView, { diff: diffJson({ a: 1, gone: true, keep: 1 }, { a: 2, b: { e: 5 }, keep: 1 }) }));
    expect(html).toContain('b.e');
    expect(html).toContain('gone');
    expect(html).toContain('~');
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
    expect(html).toContain('#3');
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
