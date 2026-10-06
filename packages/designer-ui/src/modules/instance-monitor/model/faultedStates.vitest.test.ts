import { describe, expect, it } from 'vitest';
import { faultedStatesOf } from './faultedStates';

const task = (over: Record<string, unknown>) => ({ id: 'x', taskKey: 'k', transitionKey: 't', fromState: 'a', toState: 'b', triggerType: 'manual', status: 'Completed', businessStatus: 'Success', startedAt: 's', ...over }) as never;

describe('faultedStatesOf', () => {
  it('marks the state a failed task ran for', () => {
    expect(faultedStatesOf([task({ status: 'Faulted', hook: 'onEntry', toState: 'review' })], null).faulted).toEqual(['review']);
    expect(faultedStatesOf([task({ status: 'Faulted', hook: 'onExit', fromState: 'init' })], null).faulted).toEqual(['init']);
    expect(faultedStatesOf([task({ status: 'Faulted', toState: undefined, fromState: 'init' })], null).faulted).toEqual(['init']);
  });
  it('ignores successful tasks and de-duplicates', () => {
    const r = faultedStatesOf([task({}), task({ status: 'Faulted', toState: 'b' }), task({ status: 'Faulted', toState: 'b' })], null);
    expect(r.faulted).toEqual(['b']);
  });
  it('adds the active incident state to both lists', () => {
    const r = faultedStatesOf([], { state: 'review' } as never);
    expect(r).toEqual({ faulted: ['review'], incident: ['review'] });
  });
});
