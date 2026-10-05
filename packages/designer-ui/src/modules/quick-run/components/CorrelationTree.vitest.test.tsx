import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CorrelationTreeResponse } from '../types/quickrun.types';
import { CorrelationTreeView } from './CorrelationTree';

const TREE: CorrelationTreeResponse = {
  source: 'instance-correlation',
  root: {
    id: 'root-id',
    key: 'order-4711',
    flow: 'parent',
    domain: 'core',
    ownState: 's1',
    currentState: 'grandchild-initial',
    status: 'B',
    resolved: true,
    children: [
      {
        id: 'child-id',
        flow: 'child',
        domain: 'core',
        subFlowType: 'S',
        ownState: 'child-state',
        parentState: 's1',
        terminalOutcome: 'faulted',
        resolved: false,
        unresolvedReason: 'hop-failed',
        children: [],
      },
    ],
  },
};

describe('CorrelationTreeView', () => {
  const render = (props: Partial<Parameters<typeof CorrelationTreeView>[0]>) =>
    renderToStaticMarkup(
      createElement(CorrelationTreeView, { tree: TREE, loading: false, error: null, onRefresh: () => {}, ...props }),
    );

  it('renders every node with state, subflow type and outcome', () => {
    const html = render({});
    expect(html).toContain('parent');
    expect(html).toContain('child');
    expect(html).toContain('s1 → grandchild-initial');
    expect(html).toContain('SubFlow');
    expect(html).toContain('faulted');
    expect(html).toContain('Started from: s1');
  });

  it('explains an unresolved node', () => {
    expect(render({})).toContain('could not reach this instance');
  });

  it('marks a tree read from the older hierarchy function', () => {
    expect(render({ tree: { ...TREE, source: 'hierarchy' } })).toContain('Basic tree');
  });

  it('offers open actions on child nodes only when the host can navigate', () => {
    expect(render({})).not.toContain('Open Runner');
    const html = render({ onOpenNode: () => {} });
    expect(html.match(/Open Runner/g)?.length).toBe(1);
  });

  it('shows the load error', () => {
    expect(render({ tree: null, error: 'boom' })).toContain('boom');
  });
});
