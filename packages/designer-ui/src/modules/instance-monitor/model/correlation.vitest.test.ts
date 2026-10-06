import { describe, expect, it } from 'vitest';

import { childInstancesOf, childTarget, findCorrelationNode } from './correlation';

const TREE = { source: 'instance-correlation', root: { id: 'r', flow: 'login', domain: 'core', resolved: true, children: [
  { id: 'c1', flow: 'contract', domain: 'core', parentState: 'sign', resolved: true, children: [
    { id: 'g1', flow: 'online', domain: 'core', parentState: 'invoke', resolved: true, children: [] } ] },
  { id: 'c2', flow: 'kyc', domain: 'core', parentState: 'check', resolved: true, children: [] } ] } } as never;

describe('correlation helpers', () => {
  it('finds nodes at any depth', () => { expect(findCorrelationNode(TREE, 'g1')?.flow).toBe('online'); expect(findCorrelationNode(TREE, 'zz')).toBeNull(); });
  it('lists the children started from a state', () => {
    expect(childInstancesOf(TREE, 'r', 'sign').map((n) => n.id)).toEqual(['c1']);
    expect(childInstancesOf(TREE, 'c1', 'invoke').map((n) => n.id)).toEqual(['g1']);
    expect(childInstancesOf(null, 'r', 'sign')).toEqual([]);
  });
  it('builds a child target that keeps the environment', () => {
    const parent = { domain: 'core', workflowKey: 'login', instanceId: 'r', runtimeUrl: 'http://rt', environmentName: 'Local', projectId: 'p', workflowFilePath: '/a.json' };
    expect(childTarget(parent, findCorrelationNode(TREE, 'c1')!, '/c.json')).toEqual({ ...parent, workflowKey: 'contract', instanceId: 'c1', workflowFilePath: '/c.json' });
    expect(childTarget(parent, findCorrelationNode(TREE, 'c1')!)).not.toHaveProperty('workflowFilePath');
  });
});
