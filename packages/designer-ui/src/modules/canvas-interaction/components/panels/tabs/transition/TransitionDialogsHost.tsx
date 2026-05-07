import { useState, useCallback } from 'react';
import type { Transition, ViewBinding } from '@vnext-forge-studio/vnext-types';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import type { AtomicSavedInfo } from '../../../../../../modules/save-component/componentEditorModalTypes.js';
import { useWorkflowStore } from '../../../../../../store/useWorkflowStore';
import { useProjectStore } from '../../../../../../store/useProjectStore';
import { ChooseExistingVnextComponentDialog, ChooseExistingTaskDialog } from '../ChooseExistingTaskDialog';
import { CreateNewTaskDialog } from '../CreateNewTaskDialog';
import { CreateNewComponentDialog } from '../CreateNewComponentDialog';
import { useFlowEditorSave } from '../../../../../../modules/flow-editor/FlowEditorSaveContext.js';
import { useOpenComponentEditorModal } from '../../../../../../modules/save-component/ComponentEditorModalContext.js';
import {
  componentPathToEditorRoute,
  resolveComponentEditorTargetByKeyFlowResult,
} from '../../../../../../modules/vnext-workspace/resolveComponentEditorRoute.js';
import { showNotification } from '../../../../../../notification/notification-port.js';
import type { TransitionMutations, FindTransition } from './useTransitionMutations';

export interface TransitionDialogOpeners {
  openSchemaPicker: (transitionIndex: number) => void;
  openSchemaCreator: (transitionIndex: number) => void;
  openTaskPicker: (transitionIndex: number) => void;
  openTaskCreator: (transitionIndex: number) => void;
  openViewPicker: (transitionIndex: number, bindingIndex: number | null) => void;
  openViewCreator: (transitionIndex: number, bindingIndex: number | null) => void;
  openExtensionPicker: (transitionIndex: number, bindingIndex: number | null) => void;
}

export interface TransitionDialogState {
  schemaPickerForIndex: number | null;
  setSchemaPickerForIndex: (v: number | null) => void;
  schemaCreatorForIndex: number | null;
  setSchemaCreatorForIndex: (v: number | null) => void;
  taskPickerForIndex: number | null;
  setTaskPickerForIndex: (v: number | null) => void;
  taskCreatorForIndex: number | null;
  setTaskCreatorForIndex: (v: number | null) => void;
  viewPickerTarget: { transitionIndex: number; bindingIndex: number | null } | null;
  setViewPickerTarget: (v: { transitionIndex: number; bindingIndex: number | null } | null) => void;
  viewCreatorTarget: { transitionIndex: number; bindingIndex: number | null } | null;
  setViewCreatorTarget: (v: { transitionIndex: number; bindingIndex: number | null } | null) => void;
  extensionPickerTarget: { transitionIndex: number; bindingIndex: number | null } | null;
  setExtensionPickerTarget: (v: { transitionIndex: number; bindingIndex: number | null } | null) => void;
}

/** Hook that owns dialog open/close state and returns openers + raw state for the host. */
export function useTransitionDialogs(): TransitionDialogOpeners & { dialogState: TransitionDialogState } {
  const [schemaPickerForIndex, setSchemaPickerForIndex] = useState<number | null>(null);
  const [schemaCreatorForIndex, setSchemaCreatorForIndex] = useState<number | null>(null);
  const [taskPickerForIndex, setTaskPickerForIndex] = useState<number | null>(null);
  const [taskCreatorForIndex, setTaskCreatorForIndex] = useState<number | null>(null);
  const [viewPickerTarget, setViewPickerTarget] = useState<{ transitionIndex: number; bindingIndex: number | null } | null>(null);
  const [viewCreatorTarget, setViewCreatorTarget] = useState<{ transitionIndex: number; bindingIndex: number | null } | null>(null);
  const [extensionPickerTarget, setExtensionPickerTarget] = useState<{ transitionIndex: number; bindingIndex: number | null } | null>(null);

  return {
    dialogState: {
      schemaPickerForIndex, setSchemaPickerForIndex,
      schemaCreatorForIndex, setSchemaCreatorForIndex,
      taskPickerForIndex, setTaskPickerForIndex,
      taskCreatorForIndex, setTaskCreatorForIndex,
      viewPickerTarget, setViewPickerTarget,
      viewCreatorTarget, setViewCreatorTarget,
      extensionPickerTarget, setExtensionPickerTarget,
    },
    openSchemaPicker: setSchemaPickerForIndex,
    openSchemaCreator: setSchemaCreatorForIndex,
    openTaskPicker: setTaskPickerForIndex,
    openTaskCreator: setTaskCreatorForIndex,
    openViewPicker: (tIdx, bIdx) => setViewPickerTarget({ transitionIndex: tIdx, bindingIndex: bIdx }),
    openViewCreator: (tIdx, bIdx) => setViewCreatorTarget({ transitionIndex: tIdx, bindingIndex: bIdx }),
    openExtensionPicker: (tIdx, bIdx) => setExtensionPickerTarget({ transitionIndex: tIdx, bindingIndex: bIdx }),
  };
}

interface TransitionDialogsHostProps {
  mutations: TransitionMutations;
  findTransition: FindTransition;
  dialogState: TransitionDialogState;
  /** Live transitions array for task-created handler (resolves current tasks count). */
  getTransitions: () => Transition[];
}

/**
 * Renders the 7 shared picker/creator dialogs for transition editing.
 * Wires dialog onSelect/onCreated handlers to the shared mutation callbacks.
 */
export function TransitionDialogsHost({
  mutations,
  findTransition,
  dialogState,
  getTransitions,
}: TransitionDialogsHostProps) {
  const { updateWorkflow } = useWorkflowStore();
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeProject = useProjectStore((s) => s.activeProject);
  const flowEditorSave = useFlowEditorSave();
  const openComponentEditor = useOpenComponentEditorModal();
  const { projectDomain } = mutations;

  const {
    schemaPickerForIndex, setSchemaPickerForIndex,
    schemaCreatorForIndex, setSchemaCreatorForIndex,
    taskPickerForIndex, setTaskPickerForIndex,
    taskCreatorForIndex, setTaskCreatorForIndex,
    viewPickerTarget, setViewPickerTarget,
    viewCreatorTarget, setViewCreatorTarget,
    extensionPickerTarget, setExtensionPickerTarget,
  } = dialogState;

  /* ── Schema handlers ── */
  const handleSchemaPickerSelect = useCallback((component: DiscoveredVnextComponent) => {
    if (schemaPickerForIndex == null) return;
    mutations.updateTransitionSchema(schemaPickerForIndex, {
      key: component.key,
      domain: projectDomain,
      version: component.version || '1.0.0',
      flow: component.flow || 'sys-schemas',
    });
  }, [schemaPickerForIndex, projectDomain, mutations]);

  const handleSchemaCreated = useCallback((created: DiscoveredVnextComponent) => {
    if (schemaCreatorForIndex == null) return;
    mutations.updateTransitionSchema(schemaCreatorForIndex, {
      key: created.key,
      domain: projectDomain,
      version: created.version || '1.0.0',
      flow: created.flow || 'sys-schemas',
    });
  }, [schemaCreatorForIndex, projectDomain, mutations]);

  /* ── View handlers ── */
  const handleViewPickerSelect = useCallback((component: DiscoveredVnextComponent) => {
    if (!viewPickerTarget) return;
    const { transitionIndex, bindingIndex } = viewPickerTarget;
    const ref = {
      key: component.key,
      domain: projectDomain,
      version: component.version || '1.0.0',
      flow: component.flow || 'sys-views',
    };
    if (bindingIndex != null) {
      updateWorkflow((draft: any) => {
        const ctx = findTransition(draft);
        const tr = ctx?.transitions?.[transitionIndex];
        if (!tr?.views?.[bindingIndex]) return;
        tr.views[bindingIndex].view = ref;
      });
    } else {
      const binding: ViewBinding = { view: ref, loadData: false };
      mutations.updateTransitionView(transitionIndex, binding);
    }
  }, [viewPickerTarget, projectDomain, updateWorkflow, findTransition, mutations]);

  const handleViewCreated = useCallback((created: DiscoveredVnextComponent) => {
    if (!viewCreatorTarget) return;
    const { transitionIndex, bindingIndex } = viewCreatorTarget;
    const ref = {
      key: created.key,
      domain: projectDomain,
      version: created.version || '1.0.0',
      flow: created.flow || 'sys-views',
    };
    if (bindingIndex != null) {
      updateWorkflow((draft: any) => {
        const ctx = findTransition(draft);
        const tr = ctx?.transitions?.[transitionIndex];
        if (!tr?.views?.[bindingIndex]) return;
        tr.views[bindingIndex].view = ref;
      });
    } else {
      const binding: ViewBinding = { view: ref, loadData: false };
      mutations.updateTransitionView(transitionIndex, binding);
    }
  }, [viewCreatorTarget, projectDomain, updateWorkflow, findTransition, mutations]);

  /* ── Extension handler ── */
  const handleExtensionPickerSelect = useCallback((component: DiscoveredVnextComponent) => {
    if (!extensionPickerTarget) return;
    const { transitionIndex, bindingIndex } = extensionPickerTarget;
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      const tr = ctx?.transitions?.[transitionIndex];
      if (!tr) return;

      if (bindingIndex != null) {
        const binding = tr.views?.[bindingIndex];
        if (!binding) return;
        if (!binding.extensions) binding.extensions = [];
        if (!binding.extensions.includes(component.key)) {
          binding.extensions.push(component.key);
        }
      } else {
        if (!tr.view) return;
        if (!tr.view.extensions) tr.view.extensions = [];
        if (!tr.view.extensions.includes(component.key)) {
          tr.view.extensions.push(component.key);
        }
      }
    });
  }, [extensionPickerTarget, updateWorkflow, findTransition]);

  /* ── Task handlers ── */
  const handleTaskPickerSelect = useCallback((task: DiscoveredVnextComponent) => {
    if (taskPickerForIndex != null) {
      mutations.addTask(taskPickerForIndex, task);
    }
  }, [taskPickerForIndex, mutations]);

  const handleTaskCreated = useCallback((created: DiscoveredVnextComponent) => {
    if (taskCreatorForIndex == null) return;
    const transitionIndex = taskCreatorForIndex;
    const transitions = getTransitions();
    const currentTasks = transitions[transitionIndex]?.onExecutionTasks ?? [];
    const newRowIndex = currentTasks.length;
    mutations.addTask(transitionIndex, created);
    void flowEditorSave?.saveWorkflow();

    const projectId = activeProject?.id;
    const projectPath = activeProject?.path;
    if (!projectId || !projectPath || !vnextConfig?.paths) return;

    const onAtomicSaved = (next: AtomicSavedInfo) => mutations.syncTaskRef(transitionIndex, newRowIndex, next);

    if (created.path) {
      const route = componentPathToEditorRoute(created.path, projectPath, vnextConfig.paths, 'tasks');
      if (route) {
        openComponentEditor({
          kind: 'task',
          projectId,
          group: route.group,
          name: route.name,
          onAtomicSaved,
        });
        return;
      }
    }

    const k = created.key?.trim();
    const f = created.flow?.trim();
    if (!k || !f) return;

    void (async () => {
      try {
        const res = await resolveComponentEditorTargetByKeyFlowResult(
          projectId,
          projectPath,
          vnextConfig.paths,
          k,
          f,
        );
        if (!res.ok) {
          showNotification({
            kind: 'error',
            message:
              res.failure === 'not_found'
                ? 'Could not open the task editor. Open it from the task card.'
                : 'Could not map the task file to the editor.',
          });
          return;
        }
        openComponentEditor({
          kind: res.target.kind,
          projectId,
          group: res.target.group,
          name: res.target.name,
          onAtomicSaved,
        });
      } catch {
        showNotification({ kind: 'error', message: 'Could not open the task editor.' });
      }
    })();
  }, [
    taskCreatorForIndex, getTransitions, mutations, flowEditorSave,
    activeProject, vnextConfig, openComponentEditor,
  ]);

  return (
    <>
      <ChooseExistingVnextComponentDialog
        open={schemaPickerForIndex != null}
        onOpenChange={(open) => { if (!open) setSchemaPickerForIndex(null); }}
        category="schemas"
        onSelect={handleSchemaPickerSelect}
      />
      <CreateNewComponentDialog
        open={schemaCreatorForIndex != null}
        onOpenChange={(open) => { if (!open) setSchemaCreatorForIndex(null); }}
        category="schemas"
        onCreated={handleSchemaCreated}
      />
      <ChooseExistingTaskDialog
        open={taskPickerForIndex != null}
        onOpenChange={(open) => { if (!open) setTaskPickerForIndex(null); }}
        onSelectTask={handleTaskPickerSelect}
      />
      <CreateNewTaskDialog
        open={taskCreatorForIndex != null}
        onOpenChange={(open) => { if (!open) setTaskCreatorForIndex(null); }}
        onCreated={handleTaskCreated}
      />
      <ChooseExistingVnextComponentDialog
        open={viewPickerTarget != null}
        onOpenChange={(open) => { if (!open) setViewPickerTarget(null); }}
        category="views"
        onSelect={handleViewPickerSelect}
      />
      <CreateNewComponentDialog
        open={viewCreatorTarget != null}
        onOpenChange={(open) => { if (!open) setViewCreatorTarget(null); }}
        category="views"
        onCreated={handleViewCreated}
      />
      <ChooseExistingVnextComponentDialog
        open={extensionPickerTarget != null}
        onOpenChange={(open) => { if (!open) setExtensionPickerTarget(null); }}
        category="extensions"
        onSelect={handleExtensionPickerSelect}
      />
    </>
  );
}
