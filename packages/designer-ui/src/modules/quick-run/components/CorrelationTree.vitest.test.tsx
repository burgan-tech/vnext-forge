import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CorrelationTreeNode, CorrelationTreeResponse } from '../types/quickrun.types';
import { CorrelationNodeDetails, CorrelationTreeView } from './CorrelationTree';

const child = (id: string, state: string, extra: Partial<CorrelationTreeNode> = {}): CorrelationTreeNode => ({
  id,
  flow: 'online-flow',
  domain: 'core',
  subFlowType: 'P',
  ownState: state,
  status: 'A',
  parentState: 'invoke-loop',
  resolved: true,
  children: [],
  ...extra,
});

const TREE: CorrelationTreeResponse = {
  source: 'instance-correlation',
  root: {
    id: 'root-id',
    key: 'order-4711',
    flow: 'login-flow',
    domain: 'core',
    ownState: 'all-documents-approved',
    status: 'A',
    resolved: true,
    children: [
      {
        id: 'contract-id',
        flow: 'contract-flow',
        domain: 'core',
        subFlowType: 'P',
        ownState: 'awaiting-finalize',
        currentState: 'pre-finalize',
        status: 'A',
        parentState: 'login-initial',
        resolved: true,
        children: [
          child('o1', 'pre-finalize'),
          child('o2', 'pre-finalize'),
          child('o3', 'pre-finalize'),
          child('o4', 'failed', { status: 'F', terminalOutcome: 'faulted', resolved: false, unresolvedReason: 'hop-failed' }),
        ],
      },
    ],
  },
};

describe('CorrelationTreeView', () => {
  const render = (props: Partial<Parameters<typeof CorrelationTreeView>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(CorrelationTreeView, { tree: TREE, loading: false, error: null, onRefresh: () => {}, ...props }),
    );

  it('renders compact tree rows with levels, states and type badges', () => {
    const html = render();
    expect(html).toContain('role="tree"');
    expect(html).toContain('aria-level="1"');
    expect(html).toContain('aria-level="2"');
    expect(html).toContain('login-flow');
    expect(html).toContain('this instance');
    expect(html).toContain('awaiting-finalize → pre-finalize');
    expect(html).toContain('SubProcess');
    // No more full-id cards in the list.
    expect(html).not.toContain('>contract-id<');
  });

  it('folds identical siblings into a ×N group and keeps the odd one out', () => {
    const html = render();
    expect(html).toContain('×3');
    expect(html).toContain('online-flow, 3 instances in pre-finalize');
    expect(html).toContain('could not reach this instance');
  });

  it('gives the chevron a real button and the rows a pointer cursor', () => {
    const html = render();
    expect(html).toContain('aria-label="Collapse"');
    expect(html).toContain('aria-label="Expand"');
    expect(html).toMatch(/role="treeitem"[^>]*class="[^"]*cursor-pointer/);
  });

  it('offers a row menu only when the host can navigate', () => {
    expect(render()).not.toContain('Actions for');
    expect(render({ onOpenNode: () => {} })).toContain('Actions for contract-flow');
  });

  it('renders the row menu when the host can only drill', () => {
    expect(render({ onDrillNode: () => {} })).toContain('Actions for contract-flow');
  });

  it('has the toolbar, the legend and the hierarchy note', () => {
    const html = render({ tree: { ...TREE, source: 'hierarchy' } });
    for (const text of ['Expand all', 'Collapse all', 'Refresh', 'Basic tree', 'Faulted']) expect(html).toContain(text);
  });

  it('shows the load error', () => {
    expect(render({ tree: null, error: 'boom' })).toContain('boom');
  });
});

describe('CorrelationNodeDetails', () => {
  // Radix dropdown content is not rendered in SSR, so the drill action is asserted on the dialog body.
  it('offers "Monitor this instance" only when the host can drill', () => {
    const node = TREE.root.children[0];
    const html = (props: object) => renderToStaticMarkup(createElement(CorrelationNodeDetails, { node, onOpenNode: () => {}, ...props }));
    expect(html({})).not.toContain('Monitor this instance');
    expect(html({ onDrillNode: () => {} })).toContain('Monitor this instance');
  });

  it('lists ids with copy buttons and the open actions', () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationNodeDetails, { node: TREE.root.children[0], onOpenNode: () => {} }),
    );
    for (const text of ['core/contract-flow', 'Copy Instance', 'awaiting-finalize', 'Deepest state', 'pre-finalize', 'Started from', 'Open Runner', 'Open in Designer']) {
      expect(html).toContain(text);
    }
  });
});
