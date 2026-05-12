import { create } from 'zustand';
import { produce } from 'immer';

/**
 * Schema-validation error reported by the server (AJV) or the client-side
 * baseline guard at save time. Forms read `validationErrors` from the
 * store and mark the matching input(s) with `aria-invalid="true"` so the
 * global CSS rule paints them red.
 *
 * `path` follows JSON Pointer style:
 *   - `key`, `version`, `domain` for top-level metadata
 *   - `/attributes/config/triggerDomain` for nested fields (leading `/`
 *      and slashes are present when the AJV `instancePath` produces them)
 *
 * Forms strip leading `/`, split on `/`, and match against their field
 * names — see `metadataFieldHasError` helper.
 */
export interface ComponentValidationError {
  path: string;
  message: string;
}

export interface ComponentSnapshot {
  componentJson: Record<string, unknown> | null;
  componentType: string | null;
  filePath: string | null;
  isDirty: boolean;
  undoStack: Record<string, unknown>[];
  redoStack: Record<string, unknown>[];
}

export interface ComponentState extends ComponentSnapshot {
  /** Stashed parent state while a modal editor temporarily owns the store. */
  _snapshot: ComponentSnapshot | null;
  /**
   * Errors reported by the last save attempt. Cleared on successful
   * save or when the underlying component changes (debounced).
   */
  validationErrors: ComponentValidationError[];

  setComponent: (json: Record<string, unknown>, type: string, filePath: string) => void;
  updateComponent: (updater: (draft: Record<string, unknown>) => void) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
  clear: () => void;
  setValidationErrors: (errors: ComponentValidationError[]) => void;
  clearValidationErrors: () => void;
  /** Save current data fields so a modal editor can temporarily take over the store. */
  snapshotState: () => void;
  /** Restore previously saved snapshot and discard the modal editor's state. */
  restoreSnapshot: () => void;
}

export const useComponentStore = create<ComponentState>((set, get) => ({
  componentJson: null,
  componentType: null,
  filePath: null,
  isDirty: false,
  undoStack: [],
  redoStack: [],
  _snapshot: null,
  validationErrors: [],

  setComponent: (componentJson, componentType, filePath) =>
    set({
      componentJson,
      componentType,
      filePath,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      validationErrors: [],
    }),

  updateComponent: (updater) => {
    const { componentJson, undoStack, validationErrors } = get();
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
      // Clear stale validation errors as soon as the user edits anything,
      // so the red border doesn't linger on a field they've now fixed.
      // Forms will re-receive errors on the next save attempt.
      validationErrors: validationErrors.length > 0 ? [] : validationErrors,
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

  markClean: () => set({ isDirty: false, validationErrors: [] }),

  clear: () =>
    set({
      componentJson: null,
      componentType: null,
      filePath: null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      validationErrors: [],
    }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  clearValidationErrors: () => set({ validationErrors: [] }),

  snapshotState: () => {
    const { componentJson, componentType, filePath, isDirty, undoStack, redoStack } = get();
    set({ _snapshot: { componentJson, componentType, filePath, isDirty, undoStack, redoStack } });
  },

  restoreSnapshot: () => {
    const snap = get()._snapshot;
    if (!snap) return;
    set({ ...snap, _snapshot: null });
  },
}));
