import { describe, expect, it, vi } from 'vitest';

import * as QuickRunApi from '../QuickRunApi';
import { createQuickRunPseudoDelegate } from './createQuickRunPseudoDelegate';

vi.mock('../QuickRunApi', () => ({
  fireTransition: vi.fn(),
  getData: vi.fn(),
}));

describe('createQuickRunPseudoDelegate', () => {
  it('awaits the transition follow-up before resolving submit actions', async () => {
    vi.mocked(QuickRunApi.fireTransition).mockResolvedValue({
      success: true,
      data: { id: 'instance-1', key: 'approve', status: 'B' },
    });

    let releaseFollowUp: (() => void) | undefined;
    let followUpCompleted = false;
    const onTransitionComplete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseFollowUp = () => {
            followUpCompleted = true;
            resolve();
          };
        }),
    );

    const delegate = createQuickRunPseudoDelegate({
      domain: 'demo',
      workflowKey: 'loan',
      instanceId: 'instance-1',
      runtimeUrl: 'http://localhost:9000',
      headers: { Authorization: 'Bearer token' },
      onTransitionComplete,
    });

    const submitPromise = delegate.onAction('submit', { amount: 42 }, 'approve');
    let submitResolved = false;
    void submitPromise.then(() => {
      submitResolved = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(QuickRunApi.fireTransition).toHaveBeenCalledWith({
      domain: 'demo',
      workflowKey: 'loan',
      instanceId: 'instance-1',
      transitionKey: 'approve',
      attributes: { amount: 42 },
      headers: { Authorization: 'Bearer token' },
      runtimeUrl: 'http://localhost:9000',
    });
    expect(onTransitionComplete).toHaveBeenCalledTimes(1);
    expect(followUpCompleted).toBe(false);
    expect(submitResolved).toBe(false);

    releaseFollowUp?.();
    await submitPromise;

    expect(followUpCompleted).toBe(true);
    expect(submitResolved).toBe(true);
  });
});
