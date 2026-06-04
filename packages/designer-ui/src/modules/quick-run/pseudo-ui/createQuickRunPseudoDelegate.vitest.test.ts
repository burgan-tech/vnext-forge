import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as QuickRunApi from '../QuickRunApi';
import { createQuickRunPseudoDelegate } from './createQuickRunPseudoDelegate';

vi.mock('../QuickRunApi', () => ({
  fireTransition: vi.fn(),
  executeFunction: vi.fn(),
  startInstance: vi.fn(),
  getData: vi.fn(),
}));

describe('createQuickRunPseudoDelegate', () => {
  beforeEach(() => {
    vi.mocked(QuickRunApi.fireTransition).mockReset();
    vi.mocked(QuickRunApi.executeFunction).mockReset();
    vi.mocked(QuickRunApi.startInstance).mockReset();
  });

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
      // R24: factory now reads headers + bucket config through live
      // getters so per-tab edits don't tear down the SDK tree.
      getBucketConfig: () => null,
      getSessionHeaders: () => ({ Authorization: 'Bearer token' }),
      getBindingContext: () => ({ data: null, extensions: null }),
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

  // R26 — Pre/post hook placeholder path. The SDK calls the delegate
  // once per phase; until Forge wires real audit / telemetry
  // endpoints these phases must be no-ops (log only) so the runner
  // can keep firing the main phase without side effects.
  describe('pre/post hook phases (placeholder)', () => {
    const baseParams = {
      domain: 'demo',
      workflowKey: 'loan',
      instanceId: 'instance-1',
      runtimeUrl: 'http://localhost:9000',
      getBucketConfig: () => null,
      getSessionHeaders: () => ({}),
      getBindingContext: () => ({ data: null, extensions: null }),
    } as const;

    it('does not fire a transition when context.phase === "pre"', async () => {
      const onTransitionComplete = vi.fn();
      const delegate = createQuickRunPseudoDelegate({ ...baseParams, onTransitionComplete });

      await delegate.onAction(
        'audit',
        { amount: 42 },
        'urn:client:audit:click',
        // 4th-arg `context` — extra optional param tolerated by TS
        // even though the SDK's PseudoViewDelegate.onAction signature
        // doesn't declare it yet.
        { phase: 'pre' } as never,
      );

      expect(QuickRunApi.fireTransition).not.toHaveBeenCalled();
      expect(QuickRunApi.executeFunction).not.toHaveBeenCalled();
      expect(QuickRunApi.startInstance).not.toHaveBeenCalled();
      expect(onTransitionComplete).not.toHaveBeenCalled();
    });

    it('does not fire a transition when context.phase === "post"', async () => {
      const onTransitionComplete = vi.fn();
      const delegate = createQuickRunPseudoDelegate({ ...baseParams, onTransitionComplete });

      await delegate.onAction(
        'telemetry',
        {},
        'urn:client:telemetry:click',
        { phase: 'post' } as never,
      );

      expect(QuickRunApi.fireTransition).not.toHaveBeenCalled();
      expect(QuickRunApi.executeFunction).not.toHaveBeenCalled();
      expect(QuickRunApi.startInstance).not.toHaveBeenCalled();
      expect(onTransitionComplete).not.toHaveBeenCalled();
    });

    it('falls through to main dispatch when context.phase === "main"', async () => {
      vi.mocked(QuickRunApi.fireTransition).mockResolvedValue({
        success: true,
        data: { id: 'instance-1', key: 'approve', status: 'B' },
      });
      const onTransitionComplete = vi.fn();
      const delegate = createQuickRunPseudoDelegate({ ...baseParams, onTransitionComplete });

      await delegate.onAction('submit', { amount: 1 }, 'approve', { phase: 'main' } as never);

      expect(QuickRunApi.fireTransition).toHaveBeenCalledTimes(1);
      expect(onTransitionComplete).toHaveBeenCalledTimes(1);
    });
  });
});
