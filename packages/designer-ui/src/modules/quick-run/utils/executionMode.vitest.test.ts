import { describe, expect, it } from 'vitest';

import { extractExecutionTypes, resolveEffectiveExecutionMode } from './executionMode';

const flow = {
  attributes: {
    executionType: 'A',
    startTransition: { key: 'start', executionType: 'S' },
    states: [
      { key: 'a', transitions: [{ key: 'go', executionType: 'S' }, { key: 'plain' }] },
      { key: 'b', transitions: [{ key: 'go', executionType: 'A' }] },
    ],
    sharedTransitions: [{ key: 'shared', executionType: 'S' }],
  },
};

describe('executionType resolution', () => {
  const types = extractExecutionTypes(flow);

  it('uses the transition value first, scoped to the state', () => {
    expect(resolveEffectiveExecutionMode(types, 'go', 'a')).toEqual({ sync: true, source: 'transition' });
    expect(resolveEffectiveExecutionMode(types, 'go', 'b')).toEqual({ sync: false, source: 'transition' });
    expect(resolveEffectiveExecutionMode(types, 'shared', 'a')).toEqual({ sync: true, source: 'transition' });
  });

  it('falls back to the flow value, then to nothing', () => {
    expect(resolveEffectiveExecutionMode(types, 'plain', 'a')).toEqual({ sync: false, source: 'flow' });
    expect(resolveEffectiveExecutionMode(extractExecutionTypes({ attributes: {} }), 'plain', 'a')).toBeNull();
    expect(resolveEffectiveExecutionMode(null, 'plain')).toBeNull();
  });

  it('reads the start transition for a start', () => {
    expect(resolveEffectiveExecutionMode(types, null)).toEqual({ sync: true, source: 'transition' });
  });

  it('ignores values outside S/A', () => {
    const t = extractExecutionTypes({ attributes: { executionType: 'SYNC', states: [] } });
    expect(t.flow).toBeUndefined();
  });
});
