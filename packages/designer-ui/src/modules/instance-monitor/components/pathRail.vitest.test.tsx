import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { PathRailStep } from '../model/pathRail';
import { PathRail, type PathRailProps } from './PathRail';

const step = (order: number, extra: Partial<PathRailStep> = {}): PathRailStep => ({
  order, historyId: `h${order}`, transitionKey: `t${order}`, label: `Label ${order}`, fromState: 'a', toState: 'b',
  startedAt: '2026-10-06T10:00:00Z', durationMs: 1500, trigger: 'manual', failedTasks: 0, wroteData: false, ...extra,
});
const base = (over: Partial<PathRailProps> = {}): PathRailProps => ({
  steps: [step(1), step(2, { failedTasks: 2, wroteData: true, trigger: 'event' }), step(3)],
  currentState: 'review', selectedKey: null, onSelect: vi.fn(), filter: 'all', onFilterChange: vi.fn(), follow: true, onFollowChange: vi.fn(), ...over,
});
const render = (over?: Partial<PathRailProps>) => renderToStaticMarkup(h(PathRail, base(over)));

describe('PathRail', () => {
  it('renders ordered steps, summary and the end node', () => {
    const html = render();
    expect(html).toContain('Label 1');
    expect(html).toContain('Step 3: Label 3, a to b');
    expect(html).toContain('3 steps · 4.5 s');
    expect(html).toContain('Now in review');
    expect(html).toContain('Follow latest');
  });
  it('marks failures and data writes', () => {
    const html = render();
    expect(html).toContain('⚠ 2');
    expect(html).toContain('Wrote instance data');
  });
  it('marks the selected step', () => {
    const html = render({ selectedKey: 't2' });
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Step 2: Label 2/);
    expect(html).toMatch(/aria-pressed="false"[^>]*aria-label="Step 1: Label 1/);
    expect(html).toContain('--vscode-focusBorder');
  });
  it('hides non-failed steps when filtering but keeps the end node', () => {
    const html = render({ filter: 'failed' });
    expect(html).toContain('Label 2');
    expect(html).not.toContain('Label 1');
    expect(html).toContain('Now in review');
  });
  it('disables the failed filter when nothing failed', () => {
    const html = render({ steps: [step(1)] });
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Show failed only"|<button[^>]*aria-label="Show failed only"[^>]*disabled/);
  });
  it('explains an empty path', () => {
    expect(render({ steps: [] })).toContain('No transitions yet — the path appears here as the instance moves.');
  });
});
