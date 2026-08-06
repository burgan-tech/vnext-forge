import { create } from 'zustand';

export type EditorTabKind =
  | 'file'
  | 'component'
  | 'workspace-config'
  | 'quickrun'
  /** Function Quick Runner opened from a component file (`:group/:name`). */
  | 'functionrun'
  /** Function Quick Runner opened from a live workflow instance (query-bound). */
  | 'functionrun-instance';

/** vNext component editor türleri (URL segment ile uyumlu). */
export type ComponentEditorKind =
  | 'flow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension'
  | 'mapping';

export function componentEditorTabId(
  projectId: string,
  kind: ComponentEditorKind,
  group: string,
  name: string,
): string {
  return `${projectId}:component:${kind}:${group}:${name}`;
}

/** Proje kökündeki `vnext.config.json` tam sayfa sihirbaz sekmesi. */
export function vnextWorkspaceConfigTabId(projectId: string): string {
  return `${projectId}:workspace-config`;
}

export function quickRunTabId(projectId: string, group: string, name: string): string {
  return `${projectId}:quickrun:${group}:${name}`;
}

export function functionRunTabId(projectId: string, group: string, name: string): string {
  return `${projectId}:functionrun:${group}:${name}`;
}

/**
 * Function Quick Runner opened from a live workflow instance rather than from
 * a component file, so there is no `group`/`name` path to key on.
 *
 * The instance binding is deliberately *not* part of the id: one Run tab per
 * function is reused when the user opens the same function against another
 * instance. The binding travels on the tab's `search` instead, which is what
 * lets `buildNavigatePathForTab` restore it.
 */
export function functionRunInstanceTabId(
  projectId: string,
  domain: string,
  functionKey: string,
): string {
  return `${projectId}:functionrun-instance:${domain}:${functionKey}`;
}

export interface EditorTab {
  id: string;
  title: string;
  isDirty: boolean;
  content?: string;
  kind: EditorTabKind;
  filePath?: string;
  language?: string;
  componentKind?: ComponentEditorKind;
  group?: string;
  name?: string;
  /**
   * Query string (without `?`) to re-append when navigating back to this tab.
   *
   * Only used by tabs whose route carries state outside the path — today the
   * instance-bound Function Quick Runner, whose workflow/instance binding
   * lives in the query. Without it, restoring the tab after closing a sibling
   * would drop the binding and leave the runner unbound.
   */
  search?: string;
}

/** Tabs that bulk-close actions remove; workspace-config, quickrun and functionrun stay pinned. */
export function isClosableTab(tab: EditorTab): boolean {
  return tab.kind === 'file' || tab.kind === 'component';
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;

  openTab: (tab: Omit<EditorTab, 'isDirty'>) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (keepId: string) => void;
  closeAllTabs: () => void;
  closeSavedTabs: () => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  markTabClean: (id: string) => void;
  clearTabs: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeTabId: tab.id });
      return;
    }
    set({ tabs: [...tabs, { ...tab, isDirty: false }], activeTabId: tab.id });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    const newActive =
      activeTabId === id ? next[Math.min(idx, next.length - 1)]?.id ?? null : activeTabId;
    set({ tabs: next, activeTabId: newActive });
  },

  closeOtherTabs: (keepId) => {
    const { tabs } = get();
    const next = tabs.filter((t) => t.id === keepId || !isClosableTab(t));
    set({ tabs: next, activeTabId: next.length ? keepId : null });
  },

  closeAllTabs: () => {
    const { tabs, activeTabId } = get();
    const next = tabs.filter((t) => !isClosableTab(t));
    const newActive =
      activeTabId && next.some((t) => t.id === activeTabId) ? activeTabId : next[0]?.id ?? null;
    set({ tabs: next, activeTabId: newActive });
  },

  closeSavedTabs: () => {
    const { tabs, activeTabId } = get();
    const next = tabs.filter((t) => !isClosableTab(t) || t.isDirty);
    if (next.length === 0) {
      set({ tabs: next, activeTabId: null });
      return;
    }
    if (activeTabId && next.some((t) => t.id === activeTabId)) {
      set({ tabs: next, activeTabId });
      return;
    }
    const idx = activeTabId ? tabs.findIndex((t) => t.id === activeTabId) : 0;
    const pick = idx < 0 ? 0 : Math.min(idx, next.length - 1);
    set({ tabs: next, activeTabId: next[pick]?.id ?? null });
  },

  setActiveTab: (activeTabId) => set({ activeTabId }),

  updateTabContent: (id, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.kind !== 'file' || t.id !== id) return t;
        // Monaco bazen yükleme sonrası aynı metinle onChange üretir; gereksiz "modified" önlenir.
        if (t.content === content) return t;
        return { ...t, content, isDirty: true };
      }),
    })),

  markTabClean: (id) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.kind === 'file' && t.id === id ? { ...t, isDirty: false } : t)),
    })),

  clearTabs: () => set({ tabs: [], activeTabId: null }),
}));
