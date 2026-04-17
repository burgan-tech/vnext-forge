import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface UIState {
  theme: Theme;
  propertiesPanelOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  propertiesPanelWidth: number;
  scriptPanelOpen: boolean;
  scriptPanelHeight: number;
  setTheme: (theme: Theme) => void;
  togglePropertiesPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
  setPropertiesPanelWidth: (width: number) => void;
  setScriptPanelOpen: (open: boolean) => void;
  setScriptPanelHeight: (height: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'light',
  propertiesPanelOpen: true,
  bottomPanelOpen: false,
  bottomPanelHeight: 200,
  propertiesPanelWidth: 320,
  scriptPanelOpen: false,
  scriptPanelHeight: 350,
  setTheme: (theme) => set({ theme }),
  togglePropertiesPanel: () =>
    set((state) => ({ propertiesPanelOpen: !state.propertiesPanelOpen })),
  toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
  setBottomPanelHeight: (bottomPanelHeight) => set({ bottomPanelHeight }),
  setPropertiesPanelWidth: (propertiesPanelWidth) => set({ propertiesPanelWidth }),
  setScriptPanelOpen: (scriptPanelOpen) => set({ scriptPanelOpen }),
  setScriptPanelHeight: (scriptPanelHeight) => set({ scriptPanelHeight }),
}));
