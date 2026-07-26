import { beforeEach, describe, expect, it } from 'vitest';

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
