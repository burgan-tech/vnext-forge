import { useCallback, useEffect, useRef, useState } from 'react';

import * as QuickRunApi from '../../quick-run/QuickRunApi';
import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import type { RuntimeErrorLike } from '../../quick-run/components/RuntimeErrorBanner';
import { appendPage, mergeFirstPage, outcomeOf } from '../model/dataHistoryState';
import type { MonitorTarget } from '../types';

const PAGE_SIZE = 20;

export interface DataHistoryResult {
  state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  rows: DataHistoryItem[];
  hasNext: boolean;
  error: RuntimeErrorLike | null;
  loadMore: () => void;
}

/**
 * Newest-first data versions of the level on screen. Loads when `enabled`; a changed `refreshKey`
 * refetches the first page in the background and keeps already-loaded older pages.
 */
export function useDataHistory(
  level: MonitorTarget,
  headers: Record<string, string>,
  refreshKey: number,
  enabled: boolean,
): DataHistoryResult {
  const [state, setState] = useState<DataHistoryResult['state']>('idle');
  const [rows, setRows] = useState<DataHistoryItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState<RuntimeErrorLike | null>(null);
  const pageRef = useRef(1);
  const gen = useRef(0);
  const refreshSeq = useRef(0);
  const moreBusy = useRef(false);
  const loadedFor = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const scope = useCallback(
    () => ({
      domain: level.domain,
      workflowKey: level.workflowKey,
      instanceId: level.instanceId,
      headers,
      ...(level.runtimeUrl ? { runtimeUrl: level.runtimeUrl } : {}),
    }),
    [level, headers],
  );

  const thrown = (err: unknown): RuntimeErrorLike => ({ code: 'THROWN', message: err instanceof Error ? err.message : String(err) });

  useEffect(() => {
    if (!enabled) return;
    if (loadedFor.current !== level.instanceId) {
      gen.current += 1;
      loadedFor.current = level.instanceId;
      moreBusy.current = false;
      pageRef.current = 1;
      setRows([]);
      setHasNext(false);
      setError(null);
      setState('loading');
    }
    const myGen = gen.current;
    const mySeq = ++refreshSeq.current;
    const initial = stateRef.current !== 'ready';
    if (initial) setState('loading');
    void (async () => {
      try {
        const out = outcomeOf(await QuickRunApi.getDataHistory({ ...scope(), page: 1, pageSize: PAGE_SIZE, includeData: true }));
        if (myGen !== gen.current || mySeq !== refreshSeq.current) return;
        if (out.kind === 'page') {
          setRows((prev) => mergeFirstPage(prev, out.items));
          setHasNext((prevNext) => (pageRef.current > 1 ? prevNext : out.hasNext));
          setError(null);
          setState('ready');
        } else if (out.kind === 'unavailable') {
          setRows([]);
          setHasNext(false);
          setState('unavailable');
        } else {
          setError(out.error);
          setState((s) => (s === 'ready' ? 'ready' : 'error'));
        }
      } catch (err) {
        if (myGen !== gen.current || mySeq !== refreshSeq.current) return;
        setError(thrown(err));
        setState((s) => (s === 'ready' ? 'ready' : 'error'));
      }
    })();
  }, [enabled, refreshKey, level.instanceId, scope]);

  const loadMore = useCallback(() => {
    if (!hasNext || moreBusy.current) return;
    moreBusy.current = true;
    const myGen = gen.current;
    const page = pageRef.current + 1;
    void (async () => {
      try {
        const out = outcomeOf(await QuickRunApi.getDataHistory({ ...scope(), page, pageSize: PAGE_SIZE, includeData: true }));
        if (myGen !== gen.current) return;
        if (out.kind === 'page') {
          pageRef.current = page;
          setRows((prev) => appendPage(prev, out.items));
          setHasNext(out.hasNext);
          setError(null);
        } else if (out.kind === 'error') setError(out.error);
      } catch (err) {
        if (myGen === gen.current) setError(thrown(err));
      } finally {
        if (myGen === gen.current) moreBusy.current = false;
      }
    })();
  }, [hasNext, scope]);

  return { state, rows, hasNext, error, loadMore };
}
