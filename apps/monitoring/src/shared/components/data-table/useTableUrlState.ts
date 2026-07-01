import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { encodeTableState, readTableState, writeTableState, type TableFilterMode, type TableUrlState } from './table-state-url';

interface UseTableUrlStateOptions {
  /** URL param name — use the table's `tableId`. */
  tableId: string;
  mode: TableFilterMode;
  /** The page's current table-state bundle (controlled). */
  state: TableUrlState;
  /** Called once on mount if the URL holds a valid token for this table. */
  onHydrate: (decoded: TableUrlState) => void;
}

/**
 * Bridges a data table's state and the URL, keyed by `tableId`. On first mount a
 * valid token in the URL is decoded and pushed into the page via `onHydrate`
 * (URL wins). Afterwards, state changes are mirrored back to the URL (replace, so
 * history is not spammed). Only the table's own param is touched — time-range and
 * sibling tables are preserved. Renders nothing.
 *
 * Hook logic is intentionally thin; the encode/decode/merge behavior lives in the
 * pure helpers in ./table-state-url, which carry the unit tests.
 */
export function useTableUrlState({ tableId, mode, state, onHydrate }: UseTableUrlStateOptions): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useRef(false);
  const mirrorMounted = useRef(false);

  // Hydrate once. If there is no valid token, do nothing (keep the URL clean
  // until the user actually filters).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const decoded = readTableState(searchParams, tableId, mode);
    if (decoded) onHydrate(decoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-x/exhaustive-deps
  }, []);

  // Mirror state -> URL on change. We key the effect on the encoded token (a
  // primitive string), NOT the `state` object: callers pass a fresh state
  // literal every render, so depending on the object reference would re-run the
  // effect on every render and spam history.replaceState. The token only changes
  // when the table state's effective content changes, which breaks that loop.
  const token = encodeTableState(mode, state);
  useEffect(() => {
    if (!mirrorMounted.current) {
      mirrorMounted.current = true;
      return;
    }
    const next = writeTableState(searchParams, tableId, mode, state);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-x/exhaustive-deps
  }, [token]);
}
