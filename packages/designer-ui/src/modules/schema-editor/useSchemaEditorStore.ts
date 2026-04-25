import { produce } from 'immer';
import { create } from 'zustand';

interface SchemaEditorState {
  componentJson: Record<string, unknown> | null;
  filePath: string | null;
  isDirty: boolean;
  undoStack: Record<string, unknown>[];
  redoStack: Record<string, unknown>[];
  setComponent: (json: Record<string, unknown>, filePath: string) => void;
  updateComponent: (updater: (draft: Record<string, unknown>) => void) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
  clear: () => void;
}

export const useSchemaEditorStore = create<SchemaEditorState>((set, get) => ({
  componentJson: null,
  filePath: null,
  isDirty: false,
  undoStack: [],
  redoStack: [],

  setComponent: (componentJson, filePath) =>
    set({ componentJson, filePath, isDirty: false, undoStack: [], redoStack: [] }),

  updateComponent: (updater) => {
    const { componentJson, undoStack } = get();

    if (!componentJson) {
      return;
    }

    const next = produce(componentJson, updater);

    if (next === componentJson) {
      return;
    }

    /**
     * Metadata form'lari mount aninda useEffect ile alan degerlerini geri
     * yaziyor. Tag/array gibi yeni referans atamalari immer'i her seferinde
     * yeni nesne uretmeye zorladigi icin, gercek bir degisiklik olmadan
     * `isDirty` true'ya cekiliyordu. Yapisal esitlik kontrolu ile bu sahte
     * "modified" durumunu engelliyoruz.
     */
    if (JSON.stringify(next) === JSON.stringify(componentJson)) {
      return;
    }

    set({
      componentJson: next,
      isDirty: true,
      undoStack: [...undoStack.slice(-49), componentJson],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, componentJson, redoStack } = get();

    if (undoStack.length === 0 || !componentJson) {
      return;
    }

    const previous = undoStack[undoStack.length - 1];

    set({
      componentJson: previous,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, componentJson],
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, componentJson, undoStack } = get();

    if (redoStack.length === 0 || !componentJson) {
      return;
    }

    const next = redoStack[redoStack.length - 1];

    set({
      componentJson: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, componentJson],
      isDirty: true,
    });
  },

  markClean: () => set({ isDirty: false }),

  clear: () => set({ componentJson: null, filePath: null, isDirty: false, undoStack: [], redoStack: [] }),
}));
