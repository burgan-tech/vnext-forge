import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeWorkspaceFsChange } from '../../../../../workspace-fs-events';
import {
  buildForgeUrnCatalog,
  EMPTY_URN_CATALOG,
  type ForgeUrnCatalog,
} from './forgeUrnCatalog';

/**
 * Loads the project's workflow + function URN catalog for the
 * Builder's ActionEditor. Re-runs on workspace fs change events so
 * adding/renaming a workflow or function file refreshes the picker
 * without a manual reload.
 *
 * Returns a stable shape so the Inspector can read it safely even
 * before the first fetch resolves.
 */
export function useForgeUrnCatalog(projectId: string | undefined): ForgeUrnCatalog {
  const [catalog, setCatalog] = useState<ForgeUrnCatalog>(EMPTY_URN_CATALOG);
  // Debounce a burst of fs-events so we don't refetch per-file when a
  // user lands a multi-file save (e.g. scaffold). 250ms is enough to
  // collapse a typical save burst while staying snappy.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setCatalog(EMPTY_URN_CATALOG);
      return;
    }
    try {
      const next = await buildForgeUrnCatalog(projectId);
      setCatalog(next);
    } catch (err) {
      // eslint-disable-next-line no-console -- non-fatal, picker degrades gracefully
      console.warn('[useForgeUrnCatalog] refresh failed', err);
      setCatalog(EMPTY_URN_CATALOG);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!projectId) return;
    const unsubscribe = subscribeWorkspaceFsChange(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void refresh();
      }, 250);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [projectId, refresh]);

  return catalog;
}
