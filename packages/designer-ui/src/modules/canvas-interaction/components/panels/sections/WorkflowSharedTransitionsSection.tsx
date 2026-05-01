import { useCallback, useMemo } from 'react';
import { Plus, Share2 } from 'lucide-react';
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

export function WorkflowSharedTransitionsSection() {
  const { workflowJson, updateWorkflow } = useWorkflowStore();
  if (!workflowJson) return null;

  const attrs = (workflowJson as any).attributes || {};
  const sharedTransitions: any[] = attrs.sharedTransitions || [];
  const stateOptions = useStateOptions();

  const findSharedTransition: FindTransition = useCallback((draft: any) => {
    const a = draft?.attributes;
    if (!a) return null;
    if (!a.sharedTransitions) a.sharedTransitions = [];
    return { container: a, transitions: a.sharedTransitions };
  }, []);

  const mutations = useTransitionMutations(findSharedTransition);
  const { dialogState, ...dialogOpeners } = useTransitionDialogs();

  const getTransitions = useCallback(
    () => ((workflowJson as any)?.attributes?.sharedTransitions ?? []) as Transition[],
    [workflowJson],
  );

  const addSharedTransition = () => {
    updateWorkflow((draft: any) => {
      if (!draft.attributes.sharedTransitions) draft.attributes.sharedTransitions = [];
      draft.attributes.sharedTransitions.push({
        key: `shared-${draft.attributes.sharedTransitions.length + 1}`,
        target: '$self',
        versionStrategy: 'Major',
        triggerType: 0,
        schema: null,
        labels: [{ label: 'Shared Transition', language: 'en' }],
        availableIn: [],
      });
    });
  };

  const updateAvailableIn = useCallback(
    (index: number, keys: string[]) => {
      updateWorkflow((draft: any) => {
        if (draft.attributes?.sharedTransitions?.[index]) {
          draft.attributes.sharedTransitions[index].availableIn = keys;
        }
      });
    },
    [updateWorkflow],
  );

  return (
    <MetadataSection
      title={`Shared Transitions (${sharedTransitions.length})`}
      icon={<Share2 size={13} />}
      defaultOpen={sharedTransitions.length > 0}>
      <div className="space-y-3">
        {sharedTransitions.map((st, i) => (
          <TransitionCard
            key={`shared-${st.key}-${i}`}
            transition={st}
            index={i}
            currentStateKey=""
            allStateKeys={mutations.allStateKeys}
            onUpdate={mutations.updateTransition}
            onRemove={(idx) => {
              updateWorkflow((draft: any) => {
                draft.attributes?.sharedTransitions?.splice(idx, 1);
              });
            }}
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
            availableIn={st.availableIn || []}
            onUpdateAvailableIn={(keys) => updateAvailableIn(i, keys)}
            availableInStateOptions={stateOptions}
          />
        ))}
        <button
          onClick={addSharedTransition}
          className="text-secondary-icon hover:text-secondary-foreground flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
          <Plus size={13} /> Add Shared Transition
        </button>
      </div>
      <TransitionDialogsHost
        mutations={mutations}
        findTransition={findSharedTransition}
        dialogState={dialogState}
        getTransitions={getTransitions}
      />
    </MetadataSection>
  );
}
