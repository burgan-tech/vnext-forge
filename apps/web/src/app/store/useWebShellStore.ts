import { create } from 'zustand';

export type SidebarView = 'project' | 'search' | 'validation' | 'templates';

interface WebShellState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarView: SidebarView;
  toggleSidebar: () => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarWidth: (width: number) => void;
}

/**
 * Web-only shell state: activity bar selection, sidebar visibility/width.
 * Lives in `apps/web` because the VS Code extension webview replaces this
 * chrome with VS Code's own activity bar / explorer / status bar — the
 * extension never imports this store.
 */
export const useWebShellStore = create<WebShellState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 280,
  sidebarView: 'project',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarView: (sidebarView) => set({ sidebarView, sidebarOpen: true }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
}));
