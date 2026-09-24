import { describe, expect, it } from 'vitest';
import { summarizeChildWorkflow } from './childWorkflowSummary';

const view = (key: string) => ({ view: { key, domain: 'core', version: '1.0.0', flow: 'sys-views' }, loadData: false });

const CHILD = {
  key: 'subflow-override-lab-child',
  attributes: {
    states: [
      { key: 'child-initial', stateType: 1, transitions: [{ key: 'auto-child-to-lp-wait', target: 'lp-wait', triggerType: 1 }] },
      {
        key: 'lp-wait',
        stateType: 2,
        subType: 6,
        interaction: { longPoll: { terminate: true, fallbackTimeoutSeconds: 600, roles: [{ role: 'ovr.child-ack', grant: 'allow' }] } },
        view: view('subflow-override-lab-child-lp-view'),
        transitions: [
          { key: 'confirm', target: 'child-done', triggerType: 0, view: view('subflow-override-lab-child-confirm-view') },
          { key: 'note', target: '$self', triggerType: 0, views: [view('subflow-override-lab-child-lp-view')] },
        ],
      },
      {
        key: 'gate',
        stateType: 2,
        interaction: { longPoll: { terminate: true, rule: { location: './src/Gate.csx', code: 'eA==' } } },
        transitions: [],
      },
      { key: 'child-done', stateType: 3, subType: 1, transitions: [] },
    ],
    sharedTransitions: [{ key: 'escalate', target: 'child-done', triggerType: 0, availableIn: [] }],
    cancel: { key: 'cancel', target: 'child-done', triggerType: 0, view: view('cancel-view') },
  },
};

describe('summarizeChildWorkflow', () => {
  it('lists states with their long-poll arm and view keys', () => {
    expect(summarizeChildWorkflow(CHILD)?.states).toEqual([
      { key: 'child-initial', longPollAuth: null, viewKeys: [] },
      { key: 'lp-wait', longPollAuth: 'roles', viewKeys: ['subflow-override-lab-child-lp-view'] },
      { key: 'gate', longPollAuth: 'rule', viewKeys: [] },
      { key: 'child-done', longPollAuth: null, viewKeys: [] },
    ]);
  });

  it('lists state, shared and lifecycle transitions with their view keys', () => {
    expect(summarizeChildWorkflow(CHILD)?.transitions).toEqual([
      { key: 'auto-child-to-lp-wait', viewKeys: [] },
      { key: 'confirm', viewKeys: ['subflow-override-lab-child-confirm-view'] },
      { key: 'note', viewKeys: ['subflow-override-lab-child-lp-view'] },
      { key: 'escalate', viewKeys: [] },
      { key: 'cancel', viewKeys: ['cancel-view'] },
    ]);
  });

  it('merges view keys of transitions that share a key across states', () => {
    const json = {
      attributes: {
        states: [
          { key: 'a', transitions: [{ key: 'go', view: view('v1') }] },
          { key: 'b', transitions: [{ key: 'go', view: view('v2') }] },
        ],
      },
    };
    expect(summarizeChildWorkflow(json)?.transitions).toEqual([{ key: 'go', viewKeys: ['v1', 'v2'] }]);
  });

  it('returns null for something that is not a workflow', () => {
    expect(summarizeChildWorkflow(null)).toBeNull();
    expect(summarizeChildWorkflow({ attributes: {} })).toBeNull();
  });
});
