import { useCallback } from 'react';
import { Plus, LogOut } from 'lucide-react';
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

export function WorkflowExitSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const exit = attrs.exit;
  const stateOptions = useStateOptions();

  const findExitTransition: FindTransition = useCallback((draft: any) => {
    const a = draft?.attributes;
    if (!a?.exit) return null;
    return { container: a, transitions: [a.exit] };
  }, []);

  const mutations = useTransitionMutations(findExitTransition);
  const { dialogState, ...dialogOpeners } = useTransitionDialogs();

  const getTransitions = useCallback(
    () => {
      const e = (workflowJson as any)?.attributes?.exit;
      return e ? [e as Transition] : [];
    },
    [workflowJson],
  );

  const createExit = () => {
    updateWorkflow((draft: any) => {
      draft.attributes.exit = {
        key: 'exit',
        target: '',
        triggerType: 0,
        versionStrategy: 'Minor',
        labels: [{ language: 'en', label: 'Exit' }],
        onExecutionTasks: [],
        availableIn: [],
      };
    });
  };

  const removeExit = () => {
    updateWorkflow((draft: any) => {
      delete draft.attributes.exit;
    });
  };

  const updateAvailableIn = useCallback(
    (keys: string[]) => {
      updateWorkflow((draft: any) => {
        if (draft.attributes?.exit) {
          draft.attributes.exit.availableIn = keys;
        }
      });
    },
    [updateWorkflow],
  );

  return (
    <MetadataSection title="Exit" icon={<LogOut size={13} />} defaultOpen={!!exit}>
      {exit ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-semibold">
              Exit Transition
            </span>
            <button
              onClick={removeExit}
              className="text-destructive-text hover:text-destructive-icon cursor-pointer text-[11px] font-semibold">
              Remove
            </button>
          </div>
          <TransitionCard
            transition={exit}
            index={0}
            currentStateKey=""
            allStateKeys={mutations.allStateKeys}
            onUpdate={(_, field, value) => {
              updateWorkflow((draft: any) => {
                if (draft.attributes?.exit) draft.attributes.exit[field] = value;
              });
            }}
            onRemove={() => removeExit()}
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
            availableIn={exit.availableIn || []}
            onUpdateAvailableIn={updateAvailableIn}
            availableInStateOptions={stateOptions}
            editorKind="exit"
          />
          <TransitionDialogsHost
            mutations={mutations}
            findTransition={findExitTransition}
            dialogState={dialogState}
            getTransitions={getTransitions}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Defines how the workflow handles exit. One exit configuration per workflow.
          </p>
          <button
            onClick={createExit}
            className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
            <Plus size={13} /> Create Exit Transition
          </button>
        </div>
      )}
    </MetadataSection>
  );
}
