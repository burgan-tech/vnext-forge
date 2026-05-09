import { create } from 'zustand';

export type EditorTabKind = 'file' | 'component' | 'workspace-config' | 'quickrun';

/** vNext component editor türleri (URL segment ile uyumlu). */
export type ComponentEditorKind =
  | 'flow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension';

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
}

/** Tabs that bulk-close actions remove; workspace-config and quickrun stay pinned. */
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
