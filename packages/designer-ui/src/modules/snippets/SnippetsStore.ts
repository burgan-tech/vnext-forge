import { create } from 'zustand';

import type { Snippet, SnippetScope } from './SnippetTypes.js';

type SnippetPickerMode = 'insert' | 'browse';

interface SnippetsState {
  // ── library cache ──────────────────────────────────────────────────────────
  /** Latest server result, segmented by scope. */
  personal: Snippet[];
  project: Snippet[];
  warnings: string[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  /**
   * The projectId the cache was built for; lets us reload when the user
   * switches projects without touching the personal cache.
   */
  cachedProjectId: string | null;

  // ── picker overlay state ───────────────────────────────────────────────────
  pickerOpen: boolean;
  pickerMode: SnippetPickerMode;
  query: string;
  selectedIndex: number;
  scopeFilter: 'all' | SnippetScope;
  /** Optional language filter (e.g. only show 'csx' snippets when invoked from a C# editor). */
  languageHint: string | null;

  // ── editor / sidebar state ─────────────────────────────────────────────────
  /** Snippet currently being edited in the right-pane form (`null` = closed). */
  editing: { mode: 'create' | 'edit'; scope: SnippetScope; id?: string } | null;

  // ── actions ────────────────────────────────────────────────────────────────
  setLoading(): void;
  setLibrary(args: {
    personal: Snippet[];
    project: Snippet[];
    warnings: string[];
    projectId: string | null;
  }): void;
  setError(message: string): void;

  openPicker(options?: { mode?: SnippetPickerMode; languageHint?: string | null }): void;
  closePicker(): void;
  setQuery(query: string): void;
  setScopeFilter(filter: 'all' | SnippetScope): void;
  moveSelection(delta: number, total: number): void;
  setSelection(index: number): void;

  startCreate(scope: SnippetScope): void;
  startEdit(scope: SnippetScope, id: string): void;
  closeEditor(): void;
}

export const useSnippetsStore = create<SnippetsState>((set) => ({
  personal: [],
  project: [],
  warnings: [],
  status: 'idle',
  errorMessage: null,
  cachedProjectId: null,

  pickerOpen: false,
  pickerMode: 'insert',
  query: '',
  selectedIndex: 0,
  scopeFilter: 'all',
  languageHint: null,

  editing: null,

  setLoading() {
    set({ status: 'loading', errorMessage: null });
  },
  setLibrary({ personal, project, warnings, projectId }) {
    set({
      personal,
      project,
      warnings,
      status: 'ready',
      errorMessage: null,
      cachedProjectId: projectId,
      // Keep selectedIndex valid: clamp later via moveSelection if total shrank.
      selectedIndex: 0,
    });
  },
  setError(message) {
    set({ status: 'error', errorMessage: message });
  },

  openPicker(options) {
    set({
      pickerOpen: true,
      pickerMode: options?.mode ?? 'insert',
      languageHint: options?.languageHint ?? null,
      query: '',
      selectedIndex: 0,
    });
  },
  closePicker() {
    set({ pickerOpen: false });
  },
  setQuery(query) {
    set({ query, selectedIndex: 0 });
  },
  setScopeFilter(filter) {
    set({ scopeFilter: filter, selectedIndex: 0 });
  },
  moveSelection(delta, total) {
    if (total === 0) {
      set({ selectedIndex: 0 });
      return;
    }
    set((state) => ({ selectedIndex: (state.selectedIndex + delta + total) % total }));
  },
  setSelection(index) {
    set({ selectedIndex: Math.max(0, index) });
  },

  startCreate(scope) {
    set({ editing: { mode: 'create', scope } });
  },
  startEdit(scope, id) {
    set({ editing: { mode: 'edit', scope, id } });
  },
  closeEditor() {
    set({ editing: null });
  },
}));
