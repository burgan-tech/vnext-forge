import { useCallback } from 'react';
import { Plus, Ban } from 'lucide-react';
import type { Transition } from '@vnext-forge/vnext-types';
import { useWorkflowStore } from '../../../../../store/useWorkflowStore';
import {
  TransitionCard,
  useTransitionMutations,
  useTransitionDialogs,
  TransitionDialogsHost,
  type FindTransition,
} from '../tabs/transition';
import { MetadataSection } from './MetadataSection';
import { useStateOptions } from './useStateOptions';

export function WorkflowCancelSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const cancel = attrs.cancel;
  const stateOptions = useStateOptions();

  const findCancelTransition: FindTransition = useCallback((draft: any) => {
    const a = draft?.attributes;
    if (!a?.cancel) return null;
    return { container: a, transitions: [a.cancel] };
  }, []);

  const mutations = useTransitionMutations(findCancelTransition);
  const { dialogState, ...dialogOpeners } = useTransitionDialogs();

  const getTransitions = useCallback(
    () => {
      const c = (workflowJson as any)?.attributes?.cancel;
      return c ? [c as Transition] : [];
    },
    [workflowJson],
  );

  const createCancel = () => {
    updateWorkflow((draft: any) => {
      draft.attributes.cancel = {
        key: 'cancel',
        target: '',
        triggerType: 0,
        versionStrategy: 'Minor',
        labels: [{ language: 'en', label: 'Cancel' }],
        onExecutionTasks: [],
        availableIn: [],
      };
    });
  };

  const removeCancel = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.cancel;
    });
  };

  const updateAvailableIn = useCallback(
    (keys: string[]) => {
      updateWorkflow((draft: any) => {
        if (draft.attributes?.cancel) {
          draft.attributes.cancel.availableIn = keys;
        }
      });
    },
    [updateWorkflow],
  );

  return (
    <MetadataSection title="Cancel" icon={<Ban size={13} />} defaultOpen={!!cancel}>
      {cancel ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">
              Cancel Transition
            </span>
            <button
              onClick={removeCancel}
              className="text-destructive-text hover:text-destructive-icon cursor-pointer text-[11px] font-semibold">
              Remove
            </button>
          </div>
          <TransitionCard
            transition={cancel}
            index={0}
            currentStateKey=""
            allStateKeys={mutations.allStateKeys}
            onUpdate={(_, field, value) => {
              updateWorkflow((draft: any) => {
                if (draft.attributes?.cancel) draft.attributes.cancel[field] = value;
              });
            }}
            onRemove={() => removeCancel()}
            onUpdateScript={mutations.updateTransitionScript}
            onRemoveScript={mutations.removeTransitionScript}
            onUpdateSchema={mutations.updateTransitionSchema}
            onUpdateMapping={mutations.updateTransitionMapping}
            onRemoveMapping={mutations.removeTransitionMapping}
            onUpdateRoles={mutations.updateTransitionRoles}
            onUpdateView={mutations.updateTransitionView}
            onUpdateViews={mutations.updateTransitionViews}
            onUpdateLabels={mutations.updateTransitionLabels}
            onAddTask={mutations.addTask}
            onRemoveTask={mutations.removeTask}
            onMoveTask={mutations.moveTask}
            onUpdateTaskComment={mutations.updateTaskComment}
            onUpdateTaskMapping={mutations.updateTaskMapping}
            onRemoveTaskMapping={mutations.removeTaskMapping}
            onUpdateTaskErrorBoundary={mutations.updateTaskErrorBoundary}
            onSyncTaskRef={mutations.syncTaskRef}
            onOpenSchemaPicker={dialogOpeners.openSchemaPicker}
            onOpenSchemaCreator={dialogOpeners.openSchemaCreator}
            onOpenTaskPicker={dialogOpeners.openTaskPicker}
            onOpenTaskCreator={dialogOpeners.openTaskCreator}
            onOpenViewPicker={dialogOpeners.openViewPicker}
            onOpenViewCreator={dialogOpeners.openViewCreator}
            onOpenExtensionPicker={dialogOpeners.openExtensionPicker}
            canPickExisting={mutations.canPickExisting}
            projectDomain={mutations.projectDomain}
            standalone
            availableIn={cancel.availableIn || []}
            onUpdateAvailableIn={updateAvailableIn}
            availableInStateOptions={stateOptions}
            editorKind="cancel"
          />
          <TransitionDialogsHost
            mutations={mutations}
            findTransition={findCancelTransition}
            dialogState={dialogState}
            getTransitions={getTransitions}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cancel defines how the workflow handles cancellation. One cancel configuration per workflow.
          </p>
          <button
            onClick={createCancel}
            className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
            <Plus size={13} /> Create Cancel Transition
          </button>
        </div>
      )}
    </MetadataSection>
  );
}
