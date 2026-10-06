import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_CODES } from '@vnext-forge-studio/app-contracts';

import * as QuickRunApi from '../../quick-run/QuickRunApi';
import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import type { RuntimeErrorLike } from '../../quick-run/components/RuntimeErrorBanner';
import type { MonitorTarget } from '../types';

const PAGE_SIZE = 20;

export interface DataHistoryResult {
  state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  rows: DataHistoryItem[];
  hasNext: boolean;
  error: RuntimeErrorLike | null;
  loadMore: () => void;
}

/** Newest-first data versions of the level on screen; loads when `enabled` and reloads when `refreshKey` changes. */
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
  const pageRef = useRef(0);
  const seq = useRef(0);

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

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      const mine = ++seq.current;
      if (!append) setState('loading');
      try {
        const res = await QuickRunApi.getDataHistory({ ...scope(), page, pageSize: PAGE_SIZE, includeData: true });
        if (mine !== seq.current) return;
        if (res.success) {
          pageRef.current = page;
          setRows((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
          setHasNext(res.data.hasNext);
          setError(null);
          setState('ready');
        } else if (res.error.code === ERROR_CODES.RUNTIME_NOT_FOUND) {
          setRows([]);
          setHasNext(false);
          setState('unavailable');
        } else {
          setError(res.error);
          setState('error');
        }
      } catch (err) {
        if (mine !== seq.current) return;
        setError({ code: 'THROWN', message: err instanceof Error ? err.message : String(err) });
        setState('error');
      }
    },
    [scope],
  );

  useEffect(() => {
    if (!enabled) return;
    void fetchPage(1, false);
    return () => {
      seq.current += 1;
    };
  }, [enabled, refreshKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (hasNext) void fetchPage(pageRef.current + 1, true);
  }, [hasNext, fetchPage]);

  return { state, rows, hasNext, error, loadMore };
}
