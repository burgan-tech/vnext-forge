import { create } from 'zustand';

export type SidebarView = 'project' | 'search' | 'validation' | 'templates';

interface WebShellState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarView: SidebarView;
  /** Bumps when navigating to Settings with an accordion section focus (remount Accordion). */
  settingsAccordionBootToken: number;
  /** One-shot `defaultOpenItemIds`; cleared after Settings panel reads it. */
  pendingSettingsAccordionOpenIds: string[] | null;
  toggleSidebar: () => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarWidth: (width: number) => void;
  focusSettingsAccordionSection: (sectionIds: string[]) => void;
  clearPendingSettingsAccordionOpen: () => void;
}

/**
 * Web-only shell state: activity bar selection, sidebar visibility/width.
 * Lives in `apps/web` because the VS Code extension webview replaces this
 * chrome with VS Code's own activity bar / explorer / status bar — the
 * extension never imports this store.
 */
export const useWebShellStore = create<WebShellState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 230,
  sidebarView: 'project',
  settingsAccordionBootToken: 0,
  pendingSettingsAccordionOpenIds: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarView: (sidebarView) => set({ sidebarView, sidebarOpen: true }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  focusSettingsAccordionSection: (sectionIds) =>
    set((s) => ({
      sidebarView: 'templates',
      sidebarOpen: true,
      pendingSettingsAccordionOpenIds: sectionIds,
      settingsAccordionBootToken: s.settingsAccordionBootToken + 1,
    })),
  clearPendingSettingsAccordionOpen: () => set({ pendingSettingsAccordionOpenIds: null }),
}));
