import { create } from 'zustand';

import type { QuickSwitchEntry } from './QuickSwitcherTypes.js';

interface QuickSwitcherState {
  isOpen: boolean;
  /** Project id the index was built for; reset clears it. */
  projectId: string | null;
  /** All entries, freshly fetched per open. */
  entries: QuickSwitchEntry[];
  /** Diagnostic warnings from the indexer (file paths that failed to parse). */
  warnings: string[];
  /** Loading state for the build-index call. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  /** User input. */
  query: string;
  /** Cursor index inside the filtered + ranked result list. */
  selectedIndex: number;

  open(projectId: string): void;
  close(): void;
  setIndex(projectId: string, entries: QuickSwitchEntry[], warnings: string[]): void;
  setLoading(): void;
  setError(message: string): void;
  setQuery(query: string): void;
  moveSelection(delta: number, total: number): void;
  setSelection(index: number): void;
}

export const useQuickSwitcherStore = create<QuickSwitcherState>((set) => ({
  isOpen: false,
  projectId: null,
  entries: [],
  warnings: [],
  status: 'idle',
  errorMessage: null,
  query: '',
  selectedIndex: 0,

  open(projectId) {
    set({
      isOpen: true,
      projectId,
      query: '',
      selectedIndex: 0,
      // keep previous entries if same project so reopen feels instant; the
      // hook will refetch and overwrite if the project changed.
    });
  },

  close() {
    set({ isOpen: false });
  },

  setIndex(projectId, entries, warnings) {
    set({
      projectId,
      entries,
      warnings,
      status: 'ready',
      errorMessage: null,
      selectedIndex: 0,
    });
  },

  setLoading() {
    set({ status: 'loading', errorMessage: null });
  },

  setError(message) {
    set({ status: 'error', errorMessage: message });
  },

  setQuery(query) {
    set({ query, selectedIndex: 0 });
  },

  moveSelection(delta, total) {
    if (total === 0) {
      set({ selectedIndex: 0 });
      return;
    }
    set((state) => {
      // wrap-around so arrow-down on last item lands on first
      const next = (state.selectedIndex + delta + total) % total;
      return { selectedIndex: next };
    });
  },

  setSelection(index) {
    set({ selectedIndex: Math.max(0, index) });
  },
}));
