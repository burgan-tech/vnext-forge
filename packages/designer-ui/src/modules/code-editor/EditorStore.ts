import { create } from 'zustand';

export type EditorTabKind = 'file' | 'component';

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

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;

  openTab: (tab: Omit<EditorTab, 'isDirty'>) => void;
  closeTab: (id: string) => void;
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
