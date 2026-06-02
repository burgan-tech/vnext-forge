import { beforeEach, describe, expect, it, vi } from 'vitest';

import { firePseudoUiTransition } from './firePseudoUiTransition';
import type { WorkflowBucketConfig } from '../QuickRunApi';

// Replace fireTransition with a recording spy so we can assert the
// wire payload without hitting any transport. callApi (and the rest
// of QuickRunApi) is unreachable from a vitest unit context anyway.
vi.mock('../QuickRunApi', async () => {
  return {
    fireTransition: vi.fn(),
  };
});

import * as QuickRunApi from '../QuickRunApi';

const mockedFire = QuickRunApi.fireTransition as unknown as ReturnType<typeof vi.fn>;

function makeConfig(overrides: Partial<WorkflowBucketConfig> = {}): WorkflowBucketConfig {
  return {
    key: 'wf-1',
    globalHeaders: {},
    start: { headers: {}, queryStrings: {}, body: { attributes: {} } },
    transitions: [],
    ...overrides,
  };
}

describe('firePseudoUiTransition (R24)', () => {
  beforeEach(() => {
    mockedFire.mockReset();
  });

  it('merges global, session, and per-transition headers in priority order', async () => {
    mockedFire.mockResolvedValueOnce({ success: true, data: { id: 'i', key: 'k', status: 'ok' } });

    await firePseudoUiTransition({
      domain: 'd',
      workflowKey: 'wf',
      instanceId: 'inst',
      transitionKey: 'approve',
      formData: { amount: 100 },
      sessionHeaders: { 'X-Common': 'session', 'X-Session': 'sv' },
      bucketConfig: makeConfig({
        globalHeaders: { 'X-Common': 'global', 'X-Global': 'gv' },
        transitions: [
          {
            key: 'approve',
            headers: { 'X-Common': 'per-tx', 'X-Tx': 'tv' },
            queryStrings: {},
            body: { attributes: {} },
          },
        ],
      }),
    });

    expect(mockedFire).toHaveBeenCalledTimes(1);
    const call = mockedFire.mock.calls[0][0];
    expect(call.headers).toEqual({
      'X-Common': 'per-tx', // per-transition wins
      'X-Global': 'gv',
      'X-Session': 'sv',
      'X-Tx': 'tv',
    });
  });

  it('passes formData as attributes (no instance-data merge)', async () => {
    mockedFire.mockResolvedValueOnce({ success: true, data: { id: 'i', key: 'k', status: 'ok' } });

    await firePseudoUiTransition({
      domain: 'd',
      workflowKey: 'wf',
      instanceId: 'inst',
      transitionKey: 'approve',
      formData: { amount: 100, currency: 'TRY' },
      bucketConfig: null,
    });

    const call = mockedFire.mock.calls[0][0];
    expect(call.attributes).toEqual({ amount: 100, currency: 'TRY' });
  });

  it('upserts the transition entry on success, preserving key/stage/tags/headers', async () => {
    mockedFire.mockResolvedValueOnce({ success: true, data: { id: 'i', key: 'k', status: 'ok' } });
    const persist = vi.fn();
    const cfg = makeConfig({
      transitions: [
        {
          key: 'approve',
          headers: { 'X-Tx': 'tv' },
          queryStrings: { foo: 'bar' },
          body: {
            key: 'instance-key',
            stage: 'stage-A',
            tags: ['t1', 't2'],
            attributes: { old: true },
          },
        },
      ],
    });

    await firePseudoUiTransition({
      domain: 'd',
      workflowKey: 'wf',
      instanceId: 'inst',
      transitionKey: 'approve',
      formData: { amount: 100 },
      bucketConfig: cfg,
      persist,
    });

    expect(persist).toHaveBeenCalledTimes(1);
    const nextCfg = persist.mock.calls[0][0] as WorkflowBucketConfig;
    expect(nextCfg.transitions).toHaveLength(1);
    expect(nextCfg.transitions[0]).toEqual({
      key: 'approve',
      headers: { 'X-Tx': 'tv' },          // preserved
      queryStrings: { foo: 'bar' },        // preserved
      body: {
        key: 'instance-key',               // preserved
        stage: 'stage-A',                  // preserved
        tags: ['t1', 't2'],                // preserved
        attributes: { amount: 100 },       // overwritten with formData
      },
    });
  });

  it('appends a new transition entry when none exists', async () => {
    mockedFire.mockResolvedValueOnce({ success: true, data: { id: 'i', key: 'k', status: 'ok' } });
    const persist = vi.fn();

    await firePseudoUiTransition({
      domain: 'd',
      workflowKey: 'wf',
      instanceId: 'inst',
      transitionKey: 'newTx',
      formData: { x: 1 },
      bucketConfig: makeConfig(),
      persist,
    });

    const nextCfg = persist.mock.calls[0][0] as WorkflowBucketConfig;
    expect(nextCfg.transitions).toEqual([
      {
        key: 'newTx',
        headers: {},
        queryStrings: {},
        body: { key: undefined, stage: undefined, tags: undefined, attributes: { x: 1 } },
      },
    ]);
  });

  it('does not persist when the fire fails', async () => {
    mockedFire.mockResolvedValueOnce({
      success: false,
      error: { code: 'E', message: 'boom' },
    });
    const persist = vi.fn();

    const result = await firePseudoUiTransition({
      domain: 'd',
      workflowKey: 'wf',
      instanceId: 'inst',
      transitionKey: 'approve',
      formData: {},
      bucketConfig: makeConfig(),
      persist,
    });

    expect(result.success).toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });

  it('does not persist when bucketConfig is null even if persist is provided', async () => {
    mockedFire.mockResolvedValueOnce({ success: true, data: { id: 'i', key: 'k', status: 'ok' } });
    const persist = vi.fn();

    await firePseudoUiTransition({
      domain: 'd',
      workflowKey: 'wf',
      instanceId: 'inst',
      transitionKey: 'approve',
      formData: {},
      bucketConfig: null,
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
  });

  it('reports persist errors via onPersistError without failing the fire', async () => {
    mockedFire.mockResolvedValueOnce({ success: true, data: { id: 'i', key: 'k', status: 'ok' } });
    const onPersistError = vi.fn();
    const persist = vi.fn(() => {
      throw new Error('disk full');
    });

    const result = await firePseudoUiTransition({
      domain: 'd',
      workflowKey: 'wf',
      instanceId: 'inst',
      transitionKey: 'approve',
      formData: {},
      bucketConfig: makeConfig(),
      persist,
      onPersistError,
    });

    expect(result.success).toBe(true);
    expect(onPersistError).toHaveBeenCalledTimes(1);
  });
});
