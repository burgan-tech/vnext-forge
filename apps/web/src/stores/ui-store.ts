import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type SidebarView = 'project' | 'search' | 'templates' | 'validation';

interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarView: SidebarView;
  propertiesPanelOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  sidebarWidth: number;
  propertiesPanelWidth: number;
  scriptPanelOpen: boolean;
  scriptPanelHeight: number;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarView: (view: SidebarView) => void;
  togglePropertiesPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
  setSidebarWidth: (width: number) => void;
  setPropertiesPanelWidth: (width: number) => void;
  setScriptPanelOpen: (open: boolean) => void;
  setScriptPanelHeight: (height: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'light',
  sidebarOpen: true,
  sidebarView: 'project',
  propertiesPanelOpen: true,
  bottomPanelOpen: false,
  bottomPanelHeight: 200,
  sidebarWidth: 260,
  propertiesPanelWidth: 320,
  scriptPanelOpen: false,
  scriptPanelHeight: 350,

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarView: (sidebarView) => set({ sidebarView, sidebarOpen: true }),
  togglePropertiesPanel: () => set((s) => ({ propertiesPanelOpen: !s.propertiesPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  setBottomPanelHeight: (bottomPanelHeight) => set({ bottomPanelHeight }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  setPropertiesPanelWidth: (propertiesPanelWidth) => set({ propertiesPanelWidth }),
  setScriptPanelOpen: (scriptPanelOpen) => set({ scriptPanelOpen }),
  setScriptPanelHeight: (scriptPanelHeight) => set({ scriptPanelHeight }),
}));
