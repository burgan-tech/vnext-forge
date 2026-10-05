import { describe, expect, it } from 'vitest';

import { effectiveTaskSlot, findInvalidVariableKeys, findTaskKeyCollisions, variableKeyError } from './taskSlots';

const entry = (order: number, key: string, variableKey?: string) => ({
  order,
  task: { key },
  ...(variableKey ? { variableKey } : {}),
});

describe('task response slots (runtime 0.0.99 variableKey)', () => {
  it('uses variableKey verbatim, else the camelCase task key', () => {
    expect(effectiveTaskSlot(entry(1, 'send-otp'))).toBe('sendOtp');
    expect(effectiveTaskSlot(entry(1, 'send-otp', 'otpA'))).toBe('otpA');
    expect(effectiveTaskSlot({ order: 1 })).toBeNull();
  });

  it('workflow mode only flags a shared slot within one order', () => {
    const tasks = [entry(1, 'spawn'), entry(1, 'spawn'), entry(2, 'spawn')];
    expect(findTaskKeyCollisions(tasks, 'workflow')).toEqual([
      { index: 1, key: 'spawn', collidesWith: 'spawn', variableName: 'spawn', order: 1 },
    ]);
  });

  it('a distinct variableKey resolves the parallel collision', () => {
    expect(findTaskKeyCollisions([entry(1, 'spawn', 'childA'), entry(1, 'spawn', 'childB')], 'workflow')).toEqual([]);
  });

  it('function mode flags a shared slot across all orders', () => {
    expect(findTaskKeyCollisions([entry(1, 'spawn'), entry(2, 'spawn')])).toHaveLength(1);
    expect(findTaskKeyCollisions([entry(1, 'a', 'x'), entry(2, 'b', 'x')])).toHaveLength(1);
  });

  it('validates the variableKey pattern and length', () => {
    expect(variableKeyError('valid_Key1')).toBeNull();
    expect(variableKeyError('1bad')).not.toBeNull();
    expect(variableKeyError('has-dash')).not.toBeNull();
    expect(variableKeyError('a'.repeat(101))).not.toBeNull();
    expect(findInvalidVariableKeys([entry(1, 'a', 'bad key'), entry(2, 'b', 'ok')])).toEqual([
      { index: 0, variableKey: 'bad key', reason: expect.any(String) },
    ]);
  });
});
