import { useCallback } from 'react';
import type { Transition } from '@vnext-forge/vnext-types';
import { useWorkflowStore } from '../../../../../../store/useWorkflowStore';
import { IconPlus } from '../PropertyPanelShared';
import { TransitionCard } from './TransitionCard';
import { useTransitionMutations } from './useTransitionMutations';
import { useTransitionDialogs, TransitionDialogsHost } from './TransitionDialogsHost';

export function TransitionsTab({ state }: { state: any }) {
  const { updateWorkflow } = useWorkflowStore();

  const transitions: Transition[] = state.transitions || [];
  const stateKey: string = state.key;

  const findTransition = useCallback(
    (draft: any) => {
      const s = draft.attributes?.states?.find((s: any) => s.key === stateKey);
      if (!s) return null;
      if (!s.transitions) s.transitions = [];
      return { container: s, transitions: s.transitions };
    },
    [stateKey],
  );

  const mutations = useTransitionMutations(findTransition);
  const { dialogState, ...openers } = useTransitionDialogs();

  const getTransitions = useCallback(() => transitions, [transitions]);

  /* ── Transition CRUD (list-level, not shared) ── */
  const addTransition = useCallback(() => {
    const otherKeys = mutations.allStateKeys.filter((k) => k !== stateKey);
    const target = otherKeys[0] || stateKey;
    const key = `${stateKey}-to-${target || 'new'}`;
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx) return;
      if (!ctx.container.transitions) ctx.container.transitions = [];
      ctx.container.transitions.push({
        key,
        target,
        triggerType: 0,
        versionStrategy: 'Minor',
        labels: [{ label: key, language: 'en' }],
      });
    });
  }, [updateWorkflow, findTransition, mutations.allStateKeys, stateKey]);

  const removeTransition = useCallback((index: number) => {
    updateWorkflow((draft: any) => {
      const ctx = findTransition(draft);
      if (!ctx?.transitions) return;
      ctx.transitions.splice(index, 1);
    });
  }, [updateWorkflow, findTransition]);

  return (
    <div className="space-y-2">
      <TransitionDialogsHost
        mutations={mutations}
        findTransition={findTransition}
        dialogState={dialogState}
        getTransitions={getTransitions}
      />

      {transitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-3">
          <div className="text-muted-foreground mx-auto mb-1 text-[12px] font-semibold">
            No transitions yet.
          </div>
          <div className="text-subtle text-[10px] text-center mb-3 leading-relaxed max-w-[240px]">
            Transitions define how execution moves from this state to another.
          </div>
        </div>
      ) : (
        transitions.map((t, i) => (
          <TransitionCard
            key={`${t.key}-${i}`}
            transition={t}
            index={i}
            currentStateKey={stateKey}
            allStateKeys={mutations.allStateKeys}
            onUpdate={mutations.updateTransition}
            onRemove={removeTransition}
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
            onOpenSchemaPicker={openers.openSchemaPicker}
            onOpenSchemaCreator={openers.openSchemaCreator}
            onOpenTaskPicker={openers.openTaskPicker}
            onOpenTaskCreator={openers.openTaskCreator}
            onOpenViewPicker={openers.openViewPicker}
            onOpenViewCreator={openers.openViewCreator}
            onOpenExtensionPicker={openers.openExtensionPicker}
            canPickExisting={mutations.canPickExisting}
            projectDomain={mutations.projectDomain}
          />
        ))
      )}

      <button
        type="button"
        onClick={addTransition}
        className="text-secondary-icon hover:text-secondary-foreground mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
        <IconPlus /> Add Transition
      </button>
    </div>
  );
}
