import { describe, expect, it } from 'vitest';
import { TriggerType, TriggerKind } from '@vnext-forge-studio/vnext-types';
import { resolveFieldPolicy } from './transitionFieldPolicy.js';

describe('resolveFieldPolicy — resourceLock visibility', () => {
  it('is visible for start transitions', () => {
    expect(resolveFieldPolicy('start', TriggerType.Manual).resourceLock.visible).toBe(true);
  });

  it('is visible for state transitions across trigger types', () => {
    expect(resolveFieldPolicy('state', TriggerType.Manual).resourceLock.visible).toBe(true);
    expect(resolveFieldPolicy('state', TriggerType.Event).resourceLock.visible).toBe(true);
    expect(
      resolveFieldPolicy('state', TriggerType.Automatic, TriggerKind.DefaultAuto).resourceLock.visible,
    ).toBe(true);
  });

  it('is visible for shared transitions across trigger types', () => {
    expect(resolveFieldPolicy('shared', TriggerType.Manual).resourceLock.visible).toBe(true);
    expect(resolveFieldPolicy('shared', TriggerType.Event).resourceLock.visible).toBe(true);
  });

  it('is hidden for cancel, exit, and updateData transitions', () => {
    expect(resolveFieldPolicy('cancel', TriggerType.Manual).resourceLock.visible).toBe(false);
    expect(resolveFieldPolicy('exit', TriggerType.Manual).resourceLock.visible).toBe(false);
    expect(resolveFieldPolicy('updateData', TriggerType.Manual).resourceLock.visible).toBe(false);
  });
});
