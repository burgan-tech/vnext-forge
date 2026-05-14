import { create } from 'zustand';
import { enableMapSet, produce } from 'immer';
import { suggestTransitionName } from '../modules/canvas-interaction/utils/workflowLint';

enableMapSet();

export interface WorkflowState {
  workflowJson: Record<string, unknown> | null;
  diagramJson: Record<string, unknown> | null;
  isDirty: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  undoStack: Array<{ workflow: Record<string, unknown>; diagram: Record<string, unknown> }>;
  redoStack: Array<{ workflow: Record<string, unknown>; diagram: Record<string, unknown> }>;

  setWorkflow: (json: Record<string, unknown>, diagram: Record<string, unknown>) => void;
  updateWorkflow: (updater: (draft: Record<string, unknown>) => void) => void;
  updateDiagram: (updater: (draft: Record<string, unknown>) => void) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
  clearWorkflow: () => void;

  addState: (stateType: number, subType: number, position: { x: number; y: number }) => string;
  renameState: (oldKey: string, newKey: string) => boolean;
  removeState: (key: string) => void;
  duplicateState: (key: string, position: { x: number; y: number }) => string | null;
  changeStateType: (key: string, stateType: number, subType?: number) => void;
  addTransition: (sourceKey: string, targetKey: string, triggerType?: number) => void;
  removeTransition: (sourceStateKey: string, transitionKey: string) => void;
  changeTransitionTrigger: (sourceStateKey: string, transitionKey: string, triggerType: number) => void;
  reconnectTransition: (sourceStateKey: string, transitionKey: string, newTargetKey: string) => void;
}

let stateCounter = 0;

function nextStateKey(): string {
  stateCounter++;
  return `new-state-${stateCounter}`;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowJson: null,
  diagramJson: null,
  isDirty: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  undoStack: [],
  redoStack: [],

  setWorkflow: (workflowJson, diagramJson) =>
    set({ workflowJson, diagramJson, isDirty: false, undoStack: [], redoStack: [] }),

  updateWorkflow: (updater) => {
    const { workflowJson, diagramJson, undoStack } = get();
    if (!workflowJson || !diagramJson) return;
    const next = produce(workflowJson, updater);
    set({
      workflowJson: next,
      isDirty: true,
      undoStack: [...undoStack.slice(-49), { workflow: workflowJson, diagram: diagramJson }],
      redoStack: [],
    });
  },

  updateDiagram: (updater) => {
    const { workflowJson, diagramJson, undoStack } = get();
    if (!workflowJson || !diagramJson) return;
    const next = produce(diagramJson, updater);
    set({
      diagramJson: next,
      isDirty: true,
      undoStack: [...undoStack.slice(-49), { workflow: workflowJson, diagram: diagramJson }],
      redoStack: [],
    });
  },

  setSelectedNode: (selectedNodeId) => set({ selectedNodeId, selectedEdgeId: null }),
  setSelectedEdge: (selectedEdgeId) => set({ selectedEdgeId, selectedNodeId: null }),

  undo: () => {
    const { undoStack, workflowJson, diagramJson, redoStack } = get();
    if (undoStack.length === 0 || !workflowJson || !diagramJson) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      workflowJson: prev.workflow,
      diagramJson: prev.diagram,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { workflow: workflowJson, diagram: diagramJson }],
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, workflowJson, diagramJson, undoStack } = get();
    if (redoStack.length === 0 || !workflowJson || !diagramJson) return;
    const next = redoStack[redoStack.length - 1];
    set({
      workflowJson: next.workflow,
      diagramJson: next.diagram,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { workflow: workflowJson, diagram: diagramJson }],
      isDirty: true,
    });
  },

  markClean: () => set({ isDirty: false }),

  clearWorkflow: () =>
    set({
      workflowJson: null,
      diagramJson: null,
      isDirty: false,
      selectedNodeId: null,
      selectedEdgeId: null,
      undoStack: [],
      redoStack: [],
    }),

  // ─── CRUD Helpers ───

  addState: (stateType, subType, position) => {
    const key = nextStateKey();
    const typeLabels: Record<number, string> = { 1: 'Initial', 2: 'State', 3: 'Final', 4: 'SubFlow', 5: 'Wizard' };
    const subTypeLabels: Record<number, string> = { 1: 'Success', 2: 'Error', 3: 'Terminated', 4: 'Suspended', 5: 'Busy', 6: 'Human' };
    const label = subType > 0 ? `New ${subTypeLabels[subType] || 'Final'}` : `New ${typeLabels[stateType] || 'State'}`;

    get().updateWorkflow((draft: any) => {
      if (!draft.attributes) draft.attributes = {};
      if (!draft.attributes.states) draft.attributes.states = [];
      const newState: any = {
        key,
        stateType,
        versionStrategy: 'Minor',
        labels: [{ label, language: 'en' }],
        onEntries: [],
        transitions: [],
      };
      if (subType > 0) newState.subType = subType;
      draft.attributes.states.push(newState);
    });

    get().updateDiagram((draft: any) => {
      if (!draft.nodePos) draft.nodePos = {};
      draft.nodePos[key] = { x: Math.round(position.x), y: Math.round(position.y) };
    });

    set({ selectedNodeId: key, selectedEdgeId: null });
    return key;
  },

  renameState: (oldKey, newKey) => {
    const trimmed = newKey.trim();
    if (!trimmed || trimmed === oldKey || trimmed === '__start__') return false;

    const { workflowJson } = get();
    if (!workflowJson) return false;
    const attrs = (workflowJson as any).attributes;
    const states: any[] = attrs?.states ?? [];
    if (states.some((s: any) => s.key === trimmed)) return false;

    get().updateWorkflow((draft: any) => {
      const draftAttrs = draft.attributes;
      if (!draftAttrs?.states) return;

      for (const s of draftAttrs.states) {
        if (s.key === oldKey) {
          s.key = trimmed;
        }
        if (s.transitions) {
          for (const t of s.transitions) {
            if (t.target === oldKey) t.target = trimmed;
            if (t.to === oldKey) t.to = trimmed;
            if (typeof t.key === 'string' && t.key.includes(oldKey)) {
              t.key = t.key.replaceAll(oldKey, trimmed);
            }
          }
        }
      }

      const st = draftAttrs.startTransition || draftAttrs.start;
      if (st) {
        if (st.target === oldKey) st.target = trimmed;
        if (st.to === oldKey) st.to = trimmed;
      }
    });

    get().updateDiagram((draft: any) => {
      if (draft.nodePos && draft.nodePos[oldKey]) {
        draft.nodePos[trimmed] = draft.nodePos[oldKey];
        delete draft.nodePos[oldKey];
      }
    });

    const { selectedNodeId } = get();
    if (selectedNodeId === oldKey) set({ selectedNodeId: trimmed });

    return true;
  },

  removeState: (key) => {
    get().updateWorkflow((draft: any) => {
      const attrs = draft.attributes;
      if (!attrs?.states) return;
      attrs.states = attrs.states.filter((s: any) => s.key !== key);
      for (const s of attrs.states) {
        if (s.transitions) {
          s.transitions = s.transitions.filter((t: any) => (t.target || t.to) !== key);
        }
      }
      const st = attrs.startTransition || attrs.start;
      if (st && (st.target === key || st.to === key)) {
        if (st.target !== undefined) st.target = '';
        if (st.to !== undefined) st.to = '';
      }
    });

    get().updateDiagram((draft: any) => {
      if (draft.nodePos) delete draft.nodePos[key];
    });

    const { selectedNodeId } = get();
    if (selectedNodeId === key) set({ selectedNodeId: null });
  },

  duplicateState: (key, position) => {
    const { workflowJson } = get();
    if (!workflowJson) return null;
    const attrs = (workflowJson as any).attributes;
    const state = attrs?.states?.find((s: any) => s.key === key);
    if (!state) return null;

    const newKey = nextStateKey();

    get().updateWorkflow((draft: any) => {
      const clone = JSON.parse(JSON.stringify(state));
      clone.key = newKey;
      if (clone.labels) {
        clone.labels = clone.labels.map((l: any) => ({ ...l, label: `${l.label} (copy)` }));
      }
      clone.transitions = [];
      draft.attributes.states.push(clone);
    });

    get().updateDiagram((draft: any) => {
      if (!draft.nodePos) draft.nodePos = {};
      draft.nodePos[newKey] = { x: Math.round(position.x + 40), y: Math.round(position.y + 40) };
    });

    set({ selectedNodeId: newKey, selectedEdgeId: null });
    return newKey;
  },

  changeStateType: (key, stateType, subType) => {
    get().updateWorkflow((draft: any) => {
      const state = draft.attributes?.states?.find((s: any) => s.key === key);
      if (!state) return;
      state.stateType = stateType;
      if (subType !== undefined) state.subType = subType;
      else if (stateType !== 3) delete state.subType;
      if (stateType === 3 && state.transitions?.length) {
        state.transitions = [];
      }
    });
  },

  addTransition: (sourceKey, targetKey, triggerType = 0) => {
    // Smart Transition Naming — pick a verb-first key based on
    // source/target shape (e.g. "draft → review" yields "submit",
    // "review → approve" yields "approve"). Falls back to the
    // long "source-to-target" form if the heuristic doesn't find
    // a clearer candidate that doesn't collide with an existing
    // transition on this state.
    let transitionKey = `${sourceKey}-to-${targetKey}`;
    const suggestions = suggestTransitionName(sourceKey, targetKey);
    if (suggestions.length > 0) {
      const stateList =
        (get().workflowJson?.attributes as {
          states?: Array<{ key: string; transitions?: Array<{ key: string }> }>;
        } | undefined)?.states;
      const sourceState = stateList?.find((s) => s.key === sourceKey);
      const existing = new Set((sourceState?.transitions ?? []).map((t) => t.key));
      const pick = suggestions.find((s) => !existing.has(s));
      if (pick) transitionKey = pick;
    }
    if (sourceKey === '__start__') {
      get().updateWorkflow((draft: any) => {
        const st = draft.attributes?.startTransition || draft.attributes?.start;
        if (st) st.target = targetKey;
      });
    } else {
      get().updateWorkflow((draft: any) => {
        const state = draft.attributes?.states?.find((s: any) => s.key === sourceKey);
        if (!state) return;
        if (!state.transitions) state.transitions = [];
        if (state.transitions.some((t: any) => t.key === transitionKey)) return;
        const newTransition: any = {
          key: transitionKey,
          target: targetKey,
          triggerType,
          versionStrategy: 'Minor',
          labels: [{ label: transitionKey, language: 'en' }],
        };
        if (triggerType === 2) {
          newTransition.timer = { location: '', code: '', encoding: 'B64' };
        }
        state.transitions.push(newTransition);
      });
    }
  },

  removeTransition: (sourceStateKey, transitionKey) => {
    get().updateWorkflow((draft: any) => {
      const state = draft.attributes?.states?.find((s: any) => s.key === sourceStateKey);
      if (!state?.transitions) return;
      state.transitions = state.transitions.filter((t: any) => t.key !== transitionKey);
    });
    const { selectedEdgeId } = get();
    if (selectedEdgeId?.includes(transitionKey)) set({ selectedEdgeId: null });
  },

  changeTransitionTrigger: (sourceStateKey, transitionKey, triggerType) => {
    get().updateWorkflow((draft: any) => {
      const state = draft.attributes?.states?.find((s: any) => s.key === sourceStateKey);
      if (!state?.transitions) return;
      const t = state.transitions.find((t: any) => t.key === transitionKey);
      if (t) t.triggerType = triggerType;
    });
  },

  reconnectTransition: (sourceStateKey, transitionKey, newTargetKey) => {
    if (sourceStateKey === '__start__') {
      get().updateWorkflow((draft: any) => {
        const st = draft.attributes?.startTransition || draft.attributes?.start;
        if (st) st.target = newTargetKey;
      });
    } else {
      get().updateWorkflow((draft: any) => {
        const state = draft.attributes?.states?.find((s: any) => s.key === sourceStateKey);
        if (!state?.transitions) return;
        const t = state.transitions.find((t: any) => t.key === transitionKey);
        if (t) t.target = newTargetKey;
      });
    }
  },
}));
