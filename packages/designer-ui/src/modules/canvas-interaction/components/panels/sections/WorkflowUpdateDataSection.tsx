import { useCallback } from 'react';
import { Plus, Zap } from 'lucide-react';
import type { Transition } from '@vnext-forge-studio/vnext-types';
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

export function WorkflowUpdateDataSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const updateData = attrs.updateData;
  const stateOptions = useStateOptions();

  const findUpdateDataTransition: FindTransition = useCallback((draft: any) => {
    const a = draft?.attributes;
    if (!a?.updateData) return null;
    return { container: a, transitions: [a.updateData] };
  }, []);

  const mutations = useTransitionMutations(findUpdateDataTransition);
  const { dialogState, ...dialogOpeners } = useTransitionDialogs();

  const getTransitions = useCallback(
    () => {
      const ud = (workflowJson as any)?.attributes?.updateData;
      return ud ? [ud as Transition] : [];
    },
    [workflowJson],
  );

  const createUpdateData = () => {
    updateWorkflow((draft: any) => {
      draft.attributes.updateData = {
        key: 'update-data',
        target: '$self',
        triggerType: 0,
        versionStrategy: 'Major',
        labels: [{ language: 'en', label: 'Update Data' }],
        onExecutionTasks: [],
        availableIn: [],
      };
    });
  };

  const removeUpdateData = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.updateData;
    });
  };

  const updateAvailableIn = useCallback(
    (keys: string[]) => {
      updateWorkflow((draft: any) => {
        if (draft.attributes?.updateData) {
          draft.attributes.updateData.availableIn = keys;
        }
      });
    },
    [updateWorkflow],
  );

  return (
    <MetadataSection title="Update Data" icon={<Zap size={13} />} defaultOpen={!!updateData}>
      {updateData ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">
              Update Data Transition
            </span>
            <button
              onClick={removeUpdateData}
              className="text-destructive-text hover:text-destructive-icon cursor-pointer text-[11px] font-semibold">
              Remove
            </button>
          </div>
          <TransitionCard
            transition={updateData}
            index={0}
            currentStateKey=""
            allStateKeys={mutations.allStateKeys}
            onUpdate={(_, field, value) => {
              updateWorkflow((draft: any) => {
                if (draft.attributes?.updateData) draft.attributes.updateData[field] = value;
              });
            }}
            onRemove={() => removeUpdateData()}
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
            availableIn={updateData.availableIn || []}
            onUpdateAvailableIn={updateAvailableIn}
            availableInStateOptions={stateOptions}
            editorKind="updateData"
            lockedTarget="$self"
          />
          <TransitionDialogsHost
            mutations={mutations}
            findTransition={findUpdateDataTransition}
            dialogState={dialogState}
            getTransitions={getTransitions}
          />
        </div>
      ) : (
        <button
          onClick={createUpdateData}
          className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
          <Plus size={13} /> Create Update Data Transition
        </button>
      )}
    </MetadataSection>
  );
}
