/**
 * Local Zustand store for one builder instance.
 *
 * Lifecycle: created by the `PseudoUiBuilder` shell on mount, fed an initial
 * definition + a change subscriber. All node CRUD and selection state lives
 * here; the shell mirrors definition changes back to its parent via
 * `onContentChange` (which the View Editor's outer undo stack tracks). Local
 * undo/redo here only affects the in-builder editing session.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { type BuilderDefinition, type BuilderNode, type NodePath } from '../types';
import {
  deleteNode as opDeleteNode,
  duplicateNode as opDuplicateNode,
  insertChild as opInsertChild,
  moveNode as opMoveNode,
  replaceNode as opReplaceNode,
  updateNodeProp as opUpdateNodeProp,
} from '../utils/nodeOps';
import { cloneDefinition, definitionsEqual } from '../utils/normalizeDefinition';

interface SetDefinitionOptions {
  /** When true (default) push the previous definition onto the undo stack. */
  recordHistory?: boolean;
  /** When true, normalize the selectedPath if the new tree has fewer nodes. */
  pruneSelection?: boolean;
}

export interface BuilderStoreState {
  definition: BuilderDefinition;
  selectedPath: NodePath | null;
  history: BuilderDefinition[];
  future: BuilderDefinition[];

  setDefinition: (next: BuilderDefinition, options?: SetDefinitionOptions) => void;
  selectNode: (path: NodePath | null) => void;
  insertNode: (parentPath: NodePath, index: number, node: BuilderNode) => void;
  deleteNode: (path: NodePath) => void;
  moveNode: (from: NodePath, to: NodePath, toIndex: number) => void;
  duplicateNode: (path: NodePath) => void;
  updateNodeProp: (path: NodePath, key: string, value: unknown) => void;
  replaceNode: (path: NodePath, node: BuilderNode) => void;
  updateTopLevel: (patch: Partial<BuilderDefinition>) => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 50;

export type BuilderStore = UseBoundStore<StoreApi<BuilderStoreState>>;

export function createBuilderStore(initial: BuilderDefinition): BuilderStore {
  return create<BuilderStoreState>((set, get) => ({
    definition: initial,
    selectedPath: null,
    history: [],
    future: [],

    setDefinition: (next, options) => {
      const { recordHistory = true, pruneSelection = false } = options ?? {};
      const current = get().definition;
      if (definitionsEqual(current, next)) return;
      set((state) => {
        const history = recordHistory
          ? [...state.history.slice(-MAX_HISTORY + 1), cloneDefinition(current)]
          : state.history;
        return {
          definition: next,
          history,
          future: recordHistory ? [] : state.future,
          selectedPath: pruneSelection ? null : state.selectedPath,
        };
      });
    },

    selectNode: (path) => set({ selectedPath: path }),

    insertNode: (parentPath, index, node) => {
      const def = get().definition;
      const view = opInsertChild(def.view, parentPath, index, node);
      get().setDefinition({ ...def, view });
    },

    deleteNode: (path) => {
      const def = get().definition;
      const view = opDeleteNode(def.view, path);
      get().setDefinition({ ...def, view }, { pruneSelection: true });
    },

    moveNode: (from, to, toIndex) => {
      const def = get().definition;
      const view = opMoveNode(def.view, from, to, toIndex);
      get().setDefinition({ ...def, view });
    },

    duplicateNode: (path) => {
      const def = get().definition;
      const view = opDuplicateNode(def.view, path);
      get().setDefinition({ ...def, view });
    },

    updateNodeProp: (path, key, value) => {
      const def = get().definition;
      const view = opUpdateNodeProp(def.view, path, key, value);
      get().setDefinition({ ...def, view });
    },

    replaceNode: (path, node) => {
      const def = get().definition;
      const view = opReplaceNode(def.view, path, node);
      get().setDefinition({ ...def, view });
    },

    updateTopLevel: (patch) => {
      const def = get().definition;
      get().setDefinition({ ...def, ...patch });
    },

    undo: () => {
      const { history, definition } = get();
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      set({
        definition: prev,
        history: history.slice(0, -1),
        future: [cloneDefinition(definition), ...get().future].slice(0, MAX_HISTORY),
        selectedPath: null,
      });
    },

    redo: () => {
      const { future, definition } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        definition: next,
        future: future.slice(1),
        history: [...get().history, cloneDefinition(definition)].slice(-MAX_HISTORY),
        selectedPath: null,
      });
    },
  }));
}
