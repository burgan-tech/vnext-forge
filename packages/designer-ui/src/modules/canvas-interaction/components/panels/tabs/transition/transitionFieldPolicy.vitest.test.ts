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
  it('is visible but optional for manual, scheduled and event shared transitions', () => {
    for (const triggerType of [TriggerType.Manual, TriggerType.Scheduled, TriggerType.Event]) {
      const policy = resolveFieldPolicy('shared', triggerType).availableIn;
      expect(policy.visible).toBe(true);
      expect(policy.required).toBe(false);
    }
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

describe('resolveFieldPolicy — annotations visibility', () => {
  it('is hidden for the start transition (schema has no annotations there)', () => {
    expect(resolveFieldPolicy('start', TriggerType.Manual).annotations.visible).toBe(false);
  });

  it('stays visible for every other transition kind', () => {
    for (const kind of ['state', 'shared', 'cancel', 'exit', 'updateData'] as const) {
      expect(resolveFieldPolicy(kind, TriggerType.Manual).annotations.visible).toBe(true);
    }
  });
});

describe('executionType visibility (runtime 0.0.99)', () => {
  it('is offered on manual state, shared and start transitions', () => {
    expect(resolveFieldPolicy('state', TriggerType.Manual).executionType.visible).toBe(true);
    expect(resolveFieldPolicy('shared', TriggerType.Event).executionType.visible).toBe(true);
    expect(resolveFieldPolicy('start', TriggerType.Manual).executionType.visible).toBe(true);
  });

  it('is hidden on automatic transitions and on cancel / exit / updateData', () => {
    expect(resolveFieldPolicy('state', TriggerType.Automatic).executionType.visible).toBe(false);
    expect(resolveFieldPolicy('cancel', TriggerType.Manual).executionType.visible).toBe(false);
    expect(resolveFieldPolicy('updateData', TriggerType.Manual).executionType.visible).toBe(false);
  });
});

describe('transitionFieldPolicy — priority (runtime 0.0.102)', () => {
  it('is offered only on a non-default automatic state transition', () => {
    expect(resolveFieldPolicy('state', TriggerType.Automatic).priority).toEqual({ visible: true, required: false });
    expect(resolveFieldPolicy('state', TriggerType.Automatic, TriggerKind.DefaultAuto).priority.visible).toBe(false);
    for (const trigger of [TriggerType.Manual, TriggerType.Scheduled, TriggerType.Event]) {
      expect(resolveFieldPolicy('state', trigger).priority.visible).toBe(false);
    }
  });

  it('is hidden on shared, start, cancel, exit and updateData transitions', () => {
    for (const kind of ['shared', 'start', 'cancel', 'exit', 'updateData'] as const) {
      expect(resolveFieldPolicy(kind, TriggerType.Automatic).priority.visible).toBe(false);
    }
  });
});

describe('resolveFieldPolicy — rule-based schemas (runtime 0.0.105)', () => {
  it('follows schema: offered on manual / event and on every flow-level kind', () => {
    expect(resolveFieldPolicy('state', TriggerType.Manual).schemas.visible).toBe(true);
    expect(resolveFieldPolicy('state', TriggerType.Event).schemas.visible).toBe(true);
    expect(resolveFieldPolicy('shared', TriggerType.Manual).schemas.visible).toBe(true);
    for (const kind of ['start', 'cancel', 'exit', 'updateData'] as const) {
      expect(resolveFieldPolicy(kind, TriggerType.Manual).schemas.visible).toBe(true);
    }
  });

  it('is hidden on automatic and scheduled transitions', () => {
    expect(resolveFieldPolicy('state', TriggerType.Automatic).schemas.visible).toBe(false);
    expect(resolveFieldPolicy('state', TriggerType.Automatic, TriggerKind.DefaultAuto).schemas.visible).toBe(false);
    expect(resolveFieldPolicy('state', TriggerType.Scheduled).schemas.visible).toBe(false);
    expect(resolveFieldPolicy('shared', TriggerType.Scheduled).schemas.visible).toBe(false);
  });
});
