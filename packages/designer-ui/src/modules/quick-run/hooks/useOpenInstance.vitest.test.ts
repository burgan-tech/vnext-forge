import { describe, expect, it } from 'vitest';

import { useQuickRunStore } from '../store/quickRunStore';

// `useOpenInstance` decides "already open?" from `getState()` at call time, so a
// callback held across `setWorkflowContext` (which clears instances) must see the reset.
describe('quick-run store reset', () => {
  it('setWorkflowContext clears instances, so a live read no longer finds a previously open id', () => {
    const s = useQuickRunStore.getState();
    s.addInstance({ id: 'x', key: 'k', status: 'A', domain: 'core', workflowKey: 'loan', startedAt: 't' } as never);
    expect(useQuickRunStore.getState().instances.has('x')).toBe(true);
    s.setWorkflowContext('core', 'loan', undefined, undefined);
    expect(useQuickRunStore.getState().instances.has('x')).toBe(false);
  });
});
