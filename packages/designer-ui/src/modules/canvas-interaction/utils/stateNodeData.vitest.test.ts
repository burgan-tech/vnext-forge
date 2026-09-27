import { describe, expect, it } from 'vitest';
import { toVnextWorkflow, workflowToReactFlow } from './Conversion';
import { deriveInteractionNodeData, deriveStateNodeData, longPollTooltip } from './stateNodeData';

const RULE = { location: './src/Gate.csx', code: 'eA==' };

describe('deriveInteractionNodeData', () => {
  it('is empty without a long poll', () => {
    expect(deriveInteractionNodeData(null)).toEqual({ hasLongPoll: false });
    expect(deriveInteractionNodeData({})).toEqual({ hasLongPoll: false });
  });

  it('reads a roles arm with its window', () => {
    expect(
      deriveInteractionNodeData({ longPoll: { terminate: true, fallbackTimeoutSeconds: 600, roles: [] } }),
    ).toEqual({ hasLongPoll: true, longPollAuth: 'roles', terminate: true, fallbackTimeoutSeconds: 600 });
  });

  it('reads a rule arm without a window', () => {
    expect(deriveInteractionNodeData({ longPoll: { terminate: false, rule: RULE } })).toEqual({
      hasLongPoll: true,
      longPollAuth: 'rule',
      terminate: false,
    });
  });
});

describe('longPollTooltip', () => {
  it('summarizes terminate, window and arm', () => {
    expect(longPollTooltip({ hasLongPoll: true, longPollAuth: 'roles', terminate: true, fallbackTimeoutSeconds: 600 })).toBe(
      'Long poll · terminate · 600s · roles',
    );
    expect(longPollTooltip({ hasLongPoll: true, longPollAuth: 'rule', terminate: false })).toBe(
      'Long poll · no terminate · 60s (default) · rule',
    );
    expect(longPollTooltip({ hasLongPoll: false })).toBe('No long poll');
  });
});

describe('deriveStateNodeData', () => {
  it('flags a human task nobody can see', () => {
    expect(deriveStateNodeData({ stateType: 2, subType: 6 }, undefined).humanTaskGateMissing).toBe(true);
    expect(
      deriveStateNodeData({ stateType: 2, subType: 6 }, [{ role: 'ht-approver', grant: 'allow' }]).humanTaskGateMissing,
    ).toBe(false);
  });
});

describe('workflowToReactFlow — human and long-poll node data', () => {
  function stateNodes(states: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
    return workflowToReactFlow(
      toVnextWorkflow({
        key: 'wf',
        attributes: { startTransition: { key: 'start', target: 'entry' }, states, ...extra },
      }),
      { nodePos: {} },
    ).nodes.filter((n) => n.id !== '__start__');
  }

  it('gives an intermediate Human state the humanState node type', () => {
    const [node] = stateNodes([{ key: 'entry', stateType: 2, subType: 6, transitions: [] }]);
    expect(node.type).toBe('humanState');
    expect(node.data).toMatchObject({ humanTaskGateMissing: true, hasLongPoll: false });
  });

  // Controller ruling F1: the Human (6) overlay also applies to Initial
  // states (spec A3.1/C4) — subType 6 is checked before stateType 1 in
  // getNodeType, so an Initial+Human state becomes `humanState`, not
  // `initialState`. Final and SubFlow keep their own node type for any
  // subType. (Its start/entry handle behaviour is unaffected — StateNodeBase
  // derives handle shape from `data.stateType`, not from `node.type`, and
  // `humanState` renders through the same `StateNodeBase` component as
  // `initialState` — see nodes/index.ts.)
  it('gives an Initial Human state the humanState node type, but keeps Final and SubFlow identity', () => {
    const nodes = stateNodes([
      { key: 'entry', stateType: 1, subType: 6, transitions: [] },
      { key: 'done', stateType: 3, subType: 6, transitions: [] },
      { key: 'child', stateType: 4, subType: 6, transitions: [] },
    ]);
    expect(nodes.map((n) => n.type)).toEqual(['humanState', 'finalState', 'subFlowState']);
  });

  it('carries long-poll data and honours the workflow queryRoles fallback', () => {
    const [node] = stateNodes(
      [
        {
          key: 'entry',
          stateType: 2,
          subType: 6,
          interaction: { longPoll: { terminate: true, rule: RULE } },
          transitions: [],
        },
      ],
      { queryRoles: [{ role: 'ht-approver', grant: 'allow' }] },
    );
    expect(node.data).toMatchObject({
      hasLongPoll: true,
      longPollAuth: 'rule',
      terminate: true,
      humanTaskGateMissing: false,
    });
  });
});
