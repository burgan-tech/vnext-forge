import { beforeEach, describe, expect, it } from 'vitest';

import type { HistoryResponse, StateResponse } from '../types/quickrun.types';
import { useQuickRunStore } from './quickRunStore';

describe('useQuickRunStore — etag cache', () => {
  beforeEach(() => {
    // Reset just the slices these tests touch; the store is a singleton
    // shared across the test file.
    useQuickRunStore.setState({ tabs: [], activeTabId: null, etags: {} });
  });

  it('setEtag(fn, undefined) clears only that function kind (Data-fetch-failure invalidation)', () => {
    useQuickRunStore.getState().setEtag('state', 'etag-state');
    useQuickRunStore.getState().setEtag('data', 'etag-data');
    expect(useQuickRunStore.getState().etags).toEqual({ state: 'etag-state', data: 'etag-data' });

    // Mirrors what a Data call site does on a failed/thrown getData so
    // the next request is unconditional instead of echoing a
    // stale-but-still-valid ETag and getting stuck on a 304 "keep cache"
    // branch forever.
    useQuickRunStore.getState().setEtag('data', undefined);

    expect(useQuickRunStore.getState().etags.data).toBeUndefined();
    expect(useQuickRunStore.getState().etags.state).toBe('etag-state');
  });

  it('setActiveTab to a different instance resets the whole etag cache', () => {
    useQuickRunStore.getState().setActiveTab('instance-a');
    useQuickRunStore.getState().setEtag('state', 'etag-a-state');
    useQuickRunStore.getState().setEtag('data', 'etag-a-data');
    expect(useQuickRunStore.getState().etags).toEqual({ state: 'etag-a-state', data: 'etag-a-data' });

    useQuickRunStore.getState().setActiveTab('instance-b');

    expect(useQuickRunStore.getState().etags).toEqual({});
  });

  it('setActiveTab to the SAME instance does not reset the cache', () => {
    useQuickRunStore.getState().setActiveTab('instance-a');
    useQuickRunStore.getState().setEtag('schema', 'etag-a-schema');

    useQuickRunStore.getState().setActiveTab('instance-a');

    expect(useQuickRunStore.getState().etags).toEqual({ schema: 'etag-a-schema' });
  });

  it('setWorkflowContext resets the etag cache', () => {
    useQuickRunStore.getState().setEtag('data', 'etag-data');
    expect(useQuickRunStore.getState().etags).toEqual({ data: 'etag-data' });

    useQuickRunStore.getState().setWorkflowContext('domain-a', 'workflow-a');

    expect(useQuickRunStore.getState().etags).toEqual({});
  });

  it('resetEtags clears the cache directly', () => {
    useQuickRunStore.getState().setEtag('state', 'etag-state');
    useQuickRunStore.getState().setEtag('data', 'etag-data');
    useQuickRunStore.getState().setEtag('schema', 'etag-schema');

    useQuickRunStore.getState().resetEtags();

    expect(useQuickRunStore.getState().etags).toEqual({});
  });
});

describe('useQuickRunStore — State 304 preserves activeState/activeHistory', () => {
  beforeEach(() => {
    useQuickRunStore.setState({ tabs: [], activeTabId: null, etags: {} });
  });

  it('a poll tick that only touches Data/View setters (the 304 path) leaves activeState + activeHistory (and its activeCorrelations) untouched', () => {
    const activeState: StateResponse = {
      state: 'AwaitingApproval',
      status: 'B',
      stateType: 'intermediate',
      activeCorrelations: [
        {
          correlationId: 'corr-1',
          parentState: 'AwaitingApproval',
          subFlowInstanceId: 'sub-1',
          subFlowType: 'workflow',
          subFlowDomain: 'demo',
          subFlowName: 'approval-flow',
          subFlowVersion: '1.0.0',
          isCompleted: false,
        },
      ],
    };
    const activeHistory: HistoryResponse = {
      transitions: [],
    };

    useQuickRunStore.setState({ activeState, activeHistory });

    // Mirrors exactly what pollState's State-304 branch (and its shared
    // refreshViewAndData step) is allowed to touch: Data + View setters
    // only. `setActiveState` / `patchActiveState` / `setActiveHistory`
    // must never run on a 304 — this simulates the invariant at the
    // store level without exercising the polling hook itself.
    useQuickRunStore.getState().setActiveData({ data: { foo: 'bar' } });
    useQuickRunStore.getState().setEtag('data', 'etag-data-v2');
    useQuickRunStore.getState().setStateView(null);

    expect(useQuickRunStore.getState().activeState).toBe(activeState);
    expect(useQuickRunStore.getState().activeState?.activeCorrelations).toBe(activeState.activeCorrelations);
    expect(useQuickRunStore.getState().activeHistory).toBe(activeHistory);
  });
});

describe('useQuickRunStore — last raw state response (Raw tab)', () => {
  beforeEach(() => {
    useQuickRunStore.setState({ tabs: [], activeTabId: null });
    useQuickRunStore.getState().resetInstanceScopedCaches();
  });

  const fullBody: StateResponse = {
    state: 'Draft',
    status: 'A',
    transitions: [{ name: 'submit', href: '/x' }],
    responseHeaders: { etag: 'W/"1"' },
  };

  it('stores the whole response body, including rounds activeState never sees', () => {
    // A busy round only reaches `patchActiveState`, so `activeState` is not
    // a record of what the engine sent — this field is.
    useQuickRunStore.getState().setLastStateResponse(fullBody, false);

    expect(useQuickRunStore.getState().lastStateResponse).toBe(fullBody);
    expect(useQuickRunStore.getState().lastStateNotModified).toBe(false);
    expect(useQuickRunStore.getState().lastStateReceivedAt).toBeTypeOf('number');
  });

  it('a 304 keeps the previous full body and flags it', () => {
    useQuickRunStore.getState().setLastStateResponse(fullBody, false);
    const firstAt = useQuickRunStore.getState().lastStateReceivedAt;

    // 304 responses carry no body — the caller passes what it got, and the
    // store must ignore it rather than blanking the tab.
    useQuickRunStore.getState().setLastStateResponse({ notModified: true } as StateResponse, true);

    expect(useQuickRunStore.getState().lastStateResponse).toBe(fullBody);
    expect(useQuickRunStore.getState().lastStateNotModified).toBe(true);
    expect(useQuickRunStore.getState().lastStateReceivedAt).toBeGreaterThanOrEqual(firstAt ?? 0);
  });

  it('a later full body clears the 304 flag', () => {
    useQuickRunStore.getState().setLastStateResponse(fullBody, true);
    useQuickRunStore.getState().setLastStateResponse(fullBody, false);

    expect(useQuickRunStore.getState().lastStateNotModified).toBe(false);
  });

  it('switching to another instance clears the payload and the function catalog', () => {
    useQuickRunStore.getState().setActiveTab('instance-a');
    useQuickRunStore.getState().setLastStateResponse(fullBody, false);
    useQuickRunStore.getState().setFunctionCatalog([{ name: 'f', version: '1.0.0', scope: 'I', href: '/f' }]);
    useQuickRunStore.getState().setSelectedFunctionName('f');

    useQuickRunStore.getState().setActiveTab('instance-b');

    const state = useQuickRunStore.getState();
    expect(state.lastStateResponse).toBeNull();
    expect(state.lastStateReceivedAt).toBeNull();
    expect(state.lastStateNotModified).toBe(false);
    expect(state.functionCatalog).toBeNull();
    expect(state.selectedFunctionName).toBeNull();
    expect(state.etags).toEqual({});
  });
});
