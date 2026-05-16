import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const PERSIST_KEY = 'vnext-forge-quickrun-settings';

export interface QuickRunPollingConfig {
  retryCount: number;
  intervalMs: number;
}

interface QuickRunPollingSlice {
  polling: QuickRunPollingConfig;
  setPolling: (config: Partial<QuickRunPollingConfig>) => void;
}

export const DEFAULT_QUICKRUN_POLLING: QuickRunPollingConfig = {
  retryCount: 15,
  intervalMs: 4000,
};

export const useQuickRunSettingsStore = create<QuickRunPollingSlice>()(
  persist(
    (set) => ({
      polling: { ...DEFAULT_QUICKRUN_POLLING },
      setPolling: (partial) =>
        set((state) => {
          const retryCount =
            typeof partial.retryCount === 'number' && partial.retryCount > 0
              ? partial.retryCount
              : state.polling.retryCount;
          const intervalMs =
            typeof partial.intervalMs === 'number' && partial.intervalMs > 0
              ? partial.intervalMs
              : state.polling.intervalMs;
          return { polling: { retryCount, intervalMs } };
        }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ polling: state.polling }),
      version: 1,
      migrate: (persisted) => unwrapPersistedSliceQuickRun(persisted, migrateQuickRunPersistedInner),
    },
  ),
);

function unwrapPersistedSliceQuickRun<T>(persisted: unknown, migrateInner: (inner: unknown) => T): T {
  if (persisted != null && typeof persisted === 'object' && 'state' in persisted) {
    const s = (persisted as { state?: unknown }).state;
    return migrateInner(s);
  }
  return migrateInner(persisted);
}

function migrateQuickRunPersistedInner(persisted: unknown): Pick<QuickRunPollingSlice, 'polling'> {
  if (persisted == null || typeof persisted !== 'object') {
    return { polling: { ...DEFAULT_QUICKRUN_POLLING } };
  }
  const obj = persisted as Record<string, unknown>;
  let polling = { ...DEFAULT_QUICKRUN_POLLING };
  if (typeof obj.polling === 'object' && obj.polling != null) {
    const p = obj.polling as Record<string, unknown>;
    if (typeof p.retryCount === 'number' && p.retryCount > 0) {
      polling = { ...polling, retryCount: p.retryCount };
    }
    if (typeof p.intervalMs === 'number' && p.intervalMs > 0) {
      polling = { ...polling, intervalMs: p.intervalMs };
    }
  }
  return { polling };
}
