import { create } from 'zustand';

/**
 * Editor chrome state shared across designer-ui editor views (flow, code,
 * task, schema, view, function, extension). Tracks panel visibility and
 * persistent panel sizes only — application-level concerns like theme,
 * sidebar/activity bar, status bar etc. live in the host shell.
 *
 * Lives in `designer-ui` because the same flow/code editors are mounted
 * by the web SPA AND the VS Code webview, and both shells share the same
 * panel ergonomics inside an editor.
 */
interface EditorPanelsState {
  /** Right-hand properties / inspector panel inside the flow editor. */
  propertiesPanelOpen: boolean;
  /** Bottom panel (validation, runtime, console). */
  bottomPanelOpen: boolean;
  /** Persistent height of the bottom panel in pixels. */
  bottomPanelHeight: number;
  /** Persistent width of the properties panel in pixels. */
  propertiesPanelWidth: number;
  /** CSX script editor panel (used by component / save-component editors). */
  scriptPanelOpen: boolean;
  /** Persistent height of the CSX script editor panel in pixels. */
  scriptPanelHeight: number;

  togglePropertiesPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;
  setPropertiesPanelWidth: (width: number) => void;
  setScriptPanelOpen: (open: boolean) => void;
  setScriptPanelHeight: (height: number) => void;
}

export const useEditorPanelsStore = create<EditorPanelsState>((set) => ({
  propertiesPanelOpen: true,
  bottomPanelOpen: false,
  bottomPanelHeight: 200,
  propertiesPanelWidth: 320,
  scriptPanelOpen: false,
  scriptPanelHeight: 350,
  togglePropertiesPanel: () =>
    set((state) => ({ propertiesPanelOpen: !state.propertiesPanelOpen })),
  toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
  setBottomPanelHeight: (bottomPanelHeight) => set({ bottomPanelHeight }),
  setPropertiesPanelWidth: (propertiesPanelWidth) => set({ propertiesPanelWidth }),
  setScriptPanelOpen: (scriptPanelOpen) => set({ scriptPanelOpen }),
  setScriptPanelHeight: (scriptPanelHeight) => set({ scriptPanelHeight }),
}));
