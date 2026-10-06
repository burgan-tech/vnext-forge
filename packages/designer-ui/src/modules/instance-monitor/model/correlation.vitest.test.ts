import { describe, expect, it } from 'vitest';

import { buildComponentIndex } from './componentIndex';
import { childInstancesOf, childTarget, childWorkflowFile, drillAction, findCorrelationNode } from './correlation';

const TREE = { source: 'instance-correlation', root: { id: 'r', flow: 'login', domain: 'core', resolved: true, children: [
  { id: 'c1', flow: 'contract', domain: 'core', parentState: 'sign', resolved: true, children: [
    { id: 'g1', flow: 'online', domain: 'core', parentState: 'invoke', resolved: true, children: [] } ] },
  { id: 'c2', flow: 'kyc', domain: 'core', parentState: 'check', resolved: true, children: [] } ] } } as never;

describe('childWorkflowFile', () => {
  const index = buildComponentIndex([['workflows', [{ key: 'contract', path: '/c.json' } as never]]]);
  const level = { domain: 'core', workflowKey: 'login', instanceId: 'r' };
  it('resolves only same-domain children', () => {
    expect(childWorkflowFile(index, level, { domain: 'core', flow: 'contract' } as never)).toBe('/c.json');
    expect(childWorkflowFile(index, level, { domain: 'other', flow: 'contract' } as never)).toBeUndefined();
  });
});

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

describe('drillAction', () => {
  const levels = [{ instanceId: 'r' }, { instanceId: 'c1' }, { instanceId: 'g1' }] as never;
  it('drills into an instance not on the stack', () => {
    expect(drillAction(levels, 'c2')).toEqual({ kind: 'drill' });
  });
  it('pops to an ancestor or the root already on the stack', () => {
    expect(drillAction(levels, 'r')).toEqual({ kind: 'pop', index: 0 });
    expect(drillAction(levels, 'c1')).toEqual({ kind: 'pop', index: 1 });
  });
  it('does nothing for the current level', () => {
    expect(drillAction(levels, 'g1')).toEqual({ kind: 'none' });
  });
});
