import { describe, expect, it } from 'vitest';
import { toVnextWorkflow, workflowToReactFlow } from './Conversion';

/**
 * `availableIn` drives the dashed state → workflow-transition-node edges. The
 * loops that build them used to iterate the array as plain strings, so an
 * object entry produced an `[object Object]` edge id pointing at a source node
 * that does not exist. These tests pin the state-key extraction and the
 * `roleScoped` flag the edge marker reads.
 */
function build(attributes: Record<string, unknown>) {
  return workflowToReactFlow(
    toVnextWorkflow({
      key: 'wf',
      attributes: {
        startTransition: { key: 'start', target: 'review' },
        states: [
          { key: 'review', stateType: 1, transitions: [] },
          { key: 'approval', stateType: 2, transitions: [] },
          { key: 'done', stateType: 3, transitions: [] },
        ],
        ...attributes,
      },
    }),
    { nodePos: {} },
  );
}

function availableInEdges(attributes: Record<string, unknown>) {
  return build(attributes).edges.filter(
    (e) => (e.data as Record<string, unknown> | undefined)?.isAvailableIn === true,
  );
}

describe('workflowToReactFlow — availableIn edges on lifecycle transitions', () => {
  it('builds one edge per state from the bare string form', () => {
    const edges = availableInEdges({
      cancel: { key: 'cancel', target: 'done', availableIn: ['review', 'approval'] },
    });
    expect(edges.map((e) => e.id)).toEqual([
      'review->__wf_cancel__::availableIn',
      'approval->__wf_cancel__::availableIn',
    ]);
    expect(edges.map((e) => e.source)).toEqual(['review', 'approval']);
  });

  it('reads the state key out of the object form', () => {
    const edges = availableInEdges({
      cancel: {
        key: 'cancel',
        target: 'done',
        availableIn: [{ state: 'approval', roles: [{ role: 'supervisor', grant: 'allow' }] }],
      },
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('approval->__wf_cancel__::availableIn');
    expect(edges[0].source).toBe('approval');
    expect(edges[0].id).not.toContain('object Object');
  });

  it('flags only the role-scoped entry of a mixed array', () => {
    const edges = availableInEdges({
      exit: {
        key: 'exit',
        target: 'done',
        availableIn: [
          'review',
          { state: 'approval', roles: [{ role: 'supervisor', grant: 'allow' }] },
        ],
      },
    });
    expect(edges.map((e) => (e.data as Record<string, unknown>).roleScoped)).toEqual([false, true]);
  });

  it('treats an object entry without roles as unscoped', () => {
    const edges = availableInEdges({
      updateData: { key: 'update-data', target: '$self', availableIn: [{ state: 'review' }] },
    });
    expect(edges).toHaveLength(1);
    expect((edges[0].data as Record<string, unknown>).roleScoped).toBe(false);
  });

  it('builds no edges when availableIn is absent or empty', () => {
    expect(availableInEdges({ cancel: { key: 'cancel', target: 'done' } })).toEqual([]);
    expect(availableInEdges({ cancel: { key: 'cancel', target: 'done', availableIn: [] } })).toEqual(
      [],
    );
  });
});

describe('workflowToReactFlow — availableIn edges on shared transitions', () => {
  it('points edges at the shared pseudo-node in both authored forms', () => {
    const edges = availableInEdges({
      sharedTransitions: [
        {
          key: 'escalate',
          target: 'done',
          triggerType: 0,
          availableIn: ['review', { state: 'approval', roles: [{ role: 'x', grant: 'deny' }] }],
        },
      ],
    });
    expect(edges.map((e) => e.id)).toEqual([
      'review->__wf_shared_escalate__::availableIn',
      'approval->__wf_shared_escalate__::availableIn',
    ]);
    expect(edges.every((e) => e.target === '__wf_shared_escalate__')).toBe(true);
  });

  it('never emits an edge whose source is not a real state node', () => {
    const { nodes, edges } = build({
      sharedTransitions: [
        {
          key: 'escalate',
          target: 'done',
          triggerType: 0,
          availableIn: [{ state: 'approval', roles: [{ role: 'x', grant: 'allow' }] }],
        },
      ],
    });
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
    }
  });
});
