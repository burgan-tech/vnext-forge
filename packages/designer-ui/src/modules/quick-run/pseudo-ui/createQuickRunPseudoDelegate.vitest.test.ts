import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as QuickRunApi from '../QuickRunApi';
import type { WorkflowBucketConfig } from '../QuickRunApi';
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

// Global Headers must ride along on every engine call Quick Run makes, not
// just transitions (`firePseudoUiTransition` already merges them — see
// `mergeQuickRunHeaders.ts`). These three call sites previously forwarded
// only `getSessionHeaders()` and silently dropped `bucketConfig.globalHeaders`:
// the `requestData` LOV/lookup path (bug's user-reported symptom), the
// `dispatch` → `fn` function-call path, and the `dispatch` → `flow-start`
// path.
describe('createQuickRunPseudoDelegate — global header propagation', () => {
  const GLOBAL_HEADERS = { 'X-Common': 'global', 'X-Global': 'gv' };
  const SESSION_HEADERS = { 'X-Common': 'session', 'X-Session': 'sv' };
  const EXPECTED_MERGED = { 'X-Common': 'session', 'X-Global': 'gv', 'X-Session': 'sv' };

  function makeConfig(): WorkflowBucketConfig {
    return {
      key: 'wf-1',
      globalHeaders: { ...GLOBAL_HEADERS },
      start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
      transitions: [],
    };
  }

  function makeDelegate() {
    return createQuickRunPseudoDelegate({
      domain: 'core',
      workflowKey: 'wf',
      instanceId: 'inst-1',
      runtimeUrl: 'http://localhost:4201',
      getBucketConfig: () => makeConfig(),
      getSessionHeaders: () => ({ ...SESSION_HEADERS }),
      getBindingContext: () => ({ data: null, extensions: null }),
    });
  }

  beforeEach(() => {
    vi.mocked(QuickRunApi.executeFunction).mockReset();
    vi.mocked(QuickRunApi.startInstance).mockReset();
  });

  it('sends merged headers on requestData (x-lov lookup during view render)', async () => {
    vi.mocked(QuickRunApi.executeFunction).mockResolvedValueOnce({
      success: true,
      data: { items: [] },
    });

    // `urn:vnext:fn:core:lookup-cities` — the verb segment is optional
    // (defaults to `get`), leaving the 2-segment (domain, function) form.
    await makeDelegate().requestData?.('urn:vnext:fn:core:lookup-cities', { q: 'is' });

    expect(QuickRunApi.executeFunction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(QuickRunApi.executeFunction).mock.calls[0][0].headers).toEqual(EXPECTED_MERGED);
  });

  it('sends merged headers on a function dispatch', async () => {
    vi.mocked(QuickRunApi.executeFunction).mockResolvedValueOnce({ success: true, data: {} });

    // `urn:vnext:fn:post:core:recalculate` — explicit `post` verb segment
    // followed by the 2-segment (domain, function) form.
    await makeDelegate().onAction?.(
      'dispatch',
      { amount: '10' },
      'urn:vnext:fn:post:core:recalculate',
    );

    expect(QuickRunApi.executeFunction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(QuickRunApi.executeFunction).mock.calls[0][0].headers).toEqual(EXPECTED_MERGED);
  });

  it('sends merged headers on flow-start', async () => {
    vi.mocked(QuickRunApi.startInstance).mockResolvedValueOnce({
      success: true,
      data: { id: 'new-1', key: 'k', status: 'ok' },
    });

    await makeDelegate().onAction?.('dispatch', { a: 1 }, 'urn:vnext:flow:start:core:onboarding');

    expect(QuickRunApi.startInstance).toHaveBeenCalledTimes(1);
    expect(vi.mocked(QuickRunApi.startInstance).mock.calls[0][0].headers).toEqual(EXPECTED_MERGED);
  });
});
