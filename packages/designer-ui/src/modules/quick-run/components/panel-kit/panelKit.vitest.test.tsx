import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DetailsBody, DetailsList } from './DetailsDialog';
import { PanelRow } from './PanelRow';
import { describeTaskPhase, resolveTaskOutcome } from './taskOutcome';

describe('resolveTaskOutcome', () => {
  it('merges platform and business status into one verdict', () => {
    expect(resolveTaskOutcome('completed', 'success')).toBe('ok');
    expect(resolveTaskOutcome('completed', 'unknown')).toBe('ok');
    expect(resolveTaskOutcome('completed', 'failed')).toBe('warning');
    expect(resolveTaskOutcome('faulted', 'success')).toBe('failed');
    expect(resolveTaskOutcome('busy', null)).toBe('running');
    expect(resolveTaskOutcome('waiting')).toBe('running');
    expect(resolveTaskOutcome('', '')).toBe('unknown');
  });
});

describe('describeTaskPhase', () => {
  it('names the state a hook belongs to', () => {
    expect(describeTaskPhase('onEntry', 'a', 'b')).toBe('on entry of b');
    expect(describeTaskPhase('onExit', 'a', 'b')).toBe('on exit of a');
    expect(describeTaskPhase('onExecute', 'a', 'b')).toBe('on transition');
    expect(describeTaskPhase(null, 'a', 'b')).toBeNull();
  });
});

describe('PanelRow', () => {
  it('is a keyboard-reachable button only when it has an action', () => {
    const plain = renderToStaticMarkup(createElement(PanelRow, { title: 'x' }));
    expect(plain).not.toContain('role="button"');
    const active = renderToStaticMarkup(createElement(PanelRow, { title: 'x', onActivate: () => {}, ariaLabel: 'Open x' }));
    expect(active).toContain('role="button"');
    expect(active).toContain('tabindex="0"');
    expect(active).toContain('cursor-pointer');
  });
});

describe('DetailsBody', () => {
  it('renders the selected tab only', () => {
    const html = renderToStaticMarkup(
      createElement(DetailsBody, {
        tabs: [
          { id: 'a', label: 'Overview', render: () => 'overview body' },
          { id: 'b', label: 'Request', render: () => 'request body' },
        ],
      }),
    );
    expect(html).toContain('overview body');
    expect(html).not.toContain('request body');
    expect(html).toContain('role="tablist"');
  });

  it('lists details with a copy button for ids', () => {
    const html = renderToStaticMarkup(
      createElement(DetailsList, { rows: [{ label: 'Instance', value: 'abc', copy: 'abc' }, null, false] }),
    );
    expect(html).toContain('Instance');
    expect(html).toContain('Copy Instance');
  });
});


describe('DetailsBody controlled tab', () => {
  it('renders the controlled tab and equal-width panel tabs', () => {
    const tabs = [
      { id: 'a', label: 'A', render: () => 'content-a' },
      { id: 'b', label: 'B', render: () => 'content-b' },
    ];
    const html = renderToStaticMarkup(createElement(DetailsBody, { tabs, tab: 'b', onTabChange: () => {}, variant: 'panel' }));
    expect(html).toContain('content-b');
    expect(html).not.toContain('content-a');
    expect(html).toMatch(/role="tab"[^>]*class="[^"]*flex-1/);
  });
});
