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

describe('resolveFieldPolicy — availableIn visibility', () => {
  it('is visible and required for a manual shared transition', () => {
    const policy = resolveFieldPolicy('shared', TriggerType.Manual).availableIn;
    expect(policy.visible).toBe(true);
    expect(policy.required).toBe(true);
  });

  it('is hidden for scheduled and event shared transitions', () => {
    expect(resolveFieldPolicy('shared', TriggerType.Scheduled).availableIn.visible).toBe(false);
    expect(resolveFieldPolicy('shared', TriggerType.Event).availableIn.visible).toBe(false);
  });

  it('is visible but optional for cancel, exit, and updateData transitions', () => {
    for (const kind of ['cancel', 'exit', 'updateData'] as const) {
      const policy = resolveFieldPolicy(kind, TriggerType.Manual).availableIn;
      expect(policy.visible).toBe(true);
      expect(policy.required).toBe(false);
    }
  });

  it('is hidden for state and start transitions', () => {
    expect(resolveFieldPolicy('state', TriggerType.Manual).availableIn.visible).toBe(false);
    expect(resolveFieldPolicy('state', TriggerType.Event).availableIn.visible).toBe(false);
    expect(resolveFieldPolicy('start', TriggerType.Manual).availableIn.visible).toBe(false);
  });
});
