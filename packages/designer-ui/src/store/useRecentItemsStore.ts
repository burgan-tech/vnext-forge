import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Kind of a workspace item — matches the major editor surfaces
 * we ship today. Used to filter recent lists in pickers ("show
 * me only recent workflows", etc.).
 */
export type RecentItemKind =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension';

export interface RecentItem {
  /** Absolute filesystem path within the workspace. */
  path: string;
  /** Display label (typically the component's `key` or `labels.en.label`). */
  label: string;
  /** Component category for filtering / icon mapping. */
  kind: RecentItemKind;
  /** Last opened timestamp (ms epoch). Drives the sort order. */
  openedAt: number;
}

interface RecentItemsState {
  items: RecentItem[];
  /**
   * Push a new entry. If the path already exists, the existing
   * entry is bumped to the front with a fresh timestamp (no
   * duplicates). Capped at `MAX_ITEMS` so localStorage stays
   * bounded.
   */
  pushRecent: (item: Omit<RecentItem, 'openedAt'>) => void;
  /** Drop an entry by path (e.g. when the underlying file is deleted). */
  removeRecent: (path: string) => void;
  /** Clear everything (mostly for tests / debug). */
  clearRecent: () => void;
}

const MAX_ITEMS = 50;
const STORAGE_KEY = 'vnext.recent-items.v1';

/**
 * Recently-opened workspace items, persisted to localStorage.
 * Consumed by the sidebar's "Recent" section and by quick-jump
 * pickers. The store is intentionally shared across all editor
 * shells (web + extension webview) so a workflow opened in the
 * designer also appears in the QuickRun's history.
 */
export const useRecentItemsStore = create<RecentItemsState>()(
  persist(
    (set) => ({
      items: [],
      pushRecent: (item) =>
        set((state) => {
          const now = Date.now();
          // Dedupe by path. The new entry always goes to the front.
          const filtered = state.items.filter((i) => i.path !== item.path);
          const next: RecentItem[] = [{ ...item, openedAt: now }, ...filtered];
          if (next.length > MAX_ITEMS) next.length = MAX_ITEMS;
          return { items: next };
        }),
      removeRecent: (path) =>
        set((state) => ({ items: state.items.filter((i) => i.path !== path) })),
      clearRecent: () => set({ items: [] }),
    }),
    { name: STORAGE_KEY },
  ),
);

/**
 * Read-only selector helper — returns the most-recent N items,
 * optionally filtered by kind. Pull-style API so React components
 * can compose without subscribing to every store mutation.
 */
export function selectRecentItems(
  state: RecentItemsState,
  options: { kind?: RecentItemKind; limit?: number } = {},
): RecentItem[] {
  const { kind, limit = 10 } = options;
  let list = state.items;
  if (kind) list = list.filter((i) => i.kind === kind);
  if (list.length > limit) list = list.slice(0, limit);
  return list;
}
