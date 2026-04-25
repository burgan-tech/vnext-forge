import { create } from 'zustand';
import { produce } from 'immer';

export interface ComponentState {
  componentJson: Record<string, unknown> | null;
  componentType: string | null;
  filePath: string | null;
  isDirty: boolean;
  undoStack: Record<string, unknown>[];
  redoStack: Record<string, unknown>[];

  setComponent: (json: Record<string, unknown>, type: string, filePath: string) => void;
  updateComponent: (updater: (draft: Record<string, unknown>) => void) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
  clear: () => void;
}

export const useComponentStore = create<ComponentState>((set, get) => ({
  componentJson: null,
  componentType: null,
  filePath: null,
  isDirty: false,
  undoStack: [],
  redoStack: [],

  setComponent: (componentJson, componentType, filePath) =>
    set({ componentJson, componentType, filePath, isDirty: false, undoStack: [], redoStack: [] }),

  updateComponent: (updater) => {
    const { componentJson, undoStack } = get();
    if (!componentJson) return;
    const next = produce(componentJson, updater);
    if (next === componentJson) return;
    /**
     * Metadata form'lari mount aninda useEffect ile alan degerlerini geri
     * yaziyor. Tag/array gibi yeni referans atamalari immer'i her seferinde
     * yeni nesne uretmeye zorladigi icin, gercek bir degisiklik olmadan
     * `isDirty` true'ya cekiliyordu. Yapisal esitlik kontrolu ile bu sahte
     * "modified" durumunu engelliyoruz.
     */
    if (JSON.stringify(next) === JSON.stringify(componentJson)) return;
    set({
      componentJson: next,
      isDirty: true,
      undoStack: [...undoStack.slice(-49), componentJson],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, componentJson, redoStack } = get();
    if (undoStack.length === 0 || !componentJson) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      componentJson: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, componentJson],
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, componentJson, undoStack } = get();
    if (redoStack.length === 0 || !componentJson) return;
    const next = redoStack[redoStack.length - 1];
    set({
      componentJson: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, componentJson],
      isDirty: true,
    });
  },

  markClean: () => set({ isDirty: false }),

  clear: () =>
    set({ componentJson: null, componentType: null, filePath: null, isDirty: false, undoStack: [], redoStack: [] }),
}));
