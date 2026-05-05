import { useMemo, useCallback } from 'react';
import type { Transition } from '@vnext-forge/vnext-types';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import {
  getTriggerLabel,
  getTriggerColor,
  getTriggerKindLabel,
} from './tabs/PropertyPanelHelpers';
import { Badge } from './tabs/PropertyPanelShared';
import { ArrowRight, MousePointer2, X } from 'lucide-react';
import { TransitionCard } from './tabs/transition/TransitionCard';
import { useTransitionMutations } from './tabs/transition/useTransitionMutations';
import { useTransitionDialogs, TransitionDialogsHost } from './tabs/transition/TransitionDialogsHost';

/* ────────────── Parse Edge ID ────────────── */

function parseEdgeId(edgeId: string): { sourceKey: string; transitionKey: string } | null {
  const arrowIdx = edgeId.indexOf('->');
  if (arrowIdx < 0) return null;
  const sourceKey = edgeId.substring(0, arrowIdx);
  // Use the last '::' separator to extract transitionKey (handles nested '::' in $self virtual ids)
  const lastColonIdx = edgeId.lastIndexOf('::');
  const transitionKey = lastColonIdx >= 0 ? edgeId.substring(lastColonIdx + 2) : edgeId;
  return { sourceKey, transitionKey };
}

/* ────────────── MAIN COMPONENT ────────────── */

export function TransitionPropertyPanel() {
  const { workflowJson, selectedEdgeId, updateWorkflow, setSelectedEdge } = useWorkflowStore();

  const parsed = useMemo(() => {
    if (!selectedEdgeId) return null;
    return parseEdgeId(selectedEdgeId);
  }, [selectedEdgeId]);

  const isStartTransition = parsed?.sourceKey === '__start__' || parsed?.sourceKey === 'start';

  const { transition, transitionIndex } = useMemo(() => {
    if (!workflowJson || !parsed) return { transition: null, transitionIndex: -1 };
    const attrs = (workflowJson as any).attributes;
    if (!attrs?.states) return { transition: null, transitionIndex: -1 };

    if (isStartTransition) {
      const st = attrs.startTransition || attrs.start;
      return { transition: st as Transition | null, transitionIndex: -1 };
    }

    const s = attrs.states.find((s: any) => s.key === parsed.sourceKey);
    if (!s?.transitions) return { transition: null, transitionIndex: -1 };
    const idx = s.transitions.findIndex((t: any) => t.key === parsed.transitionKey);
    return { transition: idx >= 0 ? (s.transitions[idx] as Transition) : null, transitionIndex: idx };
  }, [workflowJson, parsed, isStartTransition]);

  const sourceKey = parsed?.sourceKey ?? '';

  const findTransition = useCallback(
    (draft: any) => {
      if (isStartTransition) {
        const st = draft.attributes?.startTransition || draft.attributes?.start;
        if (!st) return null;
        return { container: draft.attributes, transitions: [st] };
      }
      const s = draft.attributes?.states?.find((s: any) => s.key === sourceKey);
      if (!s) return null;
      if (!s.transitions) s.transitions = [];
      return { container: s, transitions: s.transitions };
    },
    [sourceKey, isStartTransition],
  );

  const rawMutations = useTransitionMutations(findTransition);

  const updateTransitionWithEdgeSync = useCallback(
    (index: number, field: string, value: unknown) => {
      rawMutations.updateTransition(index, field, value);
      if (field === 'key' && typeof value === 'string' && selectedEdgeId) {
        const lastSep = selectedEdgeId.lastIndexOf('::');
        if (lastSep >= 0) {
          setSelectedEdge(selectedEdgeId.substring(0, lastSep + 2) + value);
        }
      }
    },
    [rawMutations, selectedEdgeId, setSelectedEdge],
  );

  const mutations = useMemo(
    () => ({ ...rawMutations, updateTransition: updateTransitionWithEdgeSync }),
    [rawMutations, updateTransitionWithEdgeSync],
  );

  const { dialogState, ...openers } = useTransitionDialogs();

  const getTransitions = useCallback((): Transition[] => {
    if (!transition) return [];
    if (isStartTransition) return [transition];
    const attrs = (workflowJson as any)?.attributes;
    const s = attrs?.states?.find((s: any) => s.key === sourceKey);
    return s?.transitions ?? [];
  }, [transition, isStartTransition, workflowJson, sourceKey]);

  const triggerKindLabel = getTriggerKindLabel(transition?.triggerKind ?? 0);

  if (!transition || !parsed) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="px-6 text-center">
          <div className="bg-muted text-subtle mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl">
            <MousePointer2 size={24} />
          </div>
          <div className="text-muted-foreground text-[13px] font-semibold">Select a transition</div>
          <div className="text-subtle mt-1 text-[11px]">Click on an edge in the canvas</div>
        </div>
      </div>
    );
  }

  const effectiveIndex = isStartTransition ? 0 : transitionIndex;

  /* ── Start transition: full card with start policy ── */
  if (isStartTransition) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-border-subtle bg-surface border-b px-3 py-2">
          <div className="mb-0.5 flex items-center gap-1.5">
            <div className="bg-initial/10 flex size-7 shrink-0 items-center justify-center rounded-lg">
              <ArrowRight size={13} className="text-initial" />
            </div>
            <span className="text-foreground truncate font-mono text-[13px] font-bold tracking-tight flex-1">
              Start transition
            </span>
            <button
              type="button"
              onClick={() => setSelectedEdge(null)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1 transition-colors"
              title="Close panel"
              aria-label="Close panel">
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        <TransitionDialogsHost
          mutations={mutations}
          findTransition={findTransition}
          dialogState={dialogState}
          getTransitions={getTransitions}
        />

        <div className="flex-1 overflow-y-auto p-3">
          <TransitionCard
            transition={transition}
            index={effectiveIndex}
            currentStateKey=""
            allStateKeys={mutations.allStateKeys}
            onUpdate={mutations.updateTransition}
            onRemove={() => {}}
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
            onOpenSchemaPicker={openers.openSchemaPicker}
            onOpenSchemaCreator={openers.openSchemaCreator}
            onOpenTaskPicker={openers.openTaskPicker}
            onOpenTaskCreator={openers.openTaskCreator}
            onOpenViewPicker={openers.openViewPicker}
            onOpenViewCreator={openers.openViewCreator}
            onOpenExtensionPicker={openers.openExtensionPicker}
            canPickExisting={mutations.canPickExisting}
            projectDomain={mutations.projectDomain}
            standalone
            editorKind="start"
          />
        </div>
      </div>
    );
  }

  /* ── Regular transition: full card ── */
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border-subtle bg-surface border-b px-3 py-2">
        <div className="mb-0.5 flex items-center gap-1.5">
          <div className="bg-initial/10 flex size-7 shrink-0 items-center justify-center rounded-lg">
            <ArrowRight size={13} className="text-initial" />
          </div>
          <span className="text-foreground truncate font-mono text-[13px] font-bold tracking-tight flex-1">
            {transition.key || 'transition'}
          </span>
          <button
            type="button"
            onClick={() => setSelectedEdge(null)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1 transition-colors"
            title="Close panel"
            aria-label="Close panel">
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="ml-9 flex items-center gap-2">
          <Badge className={getTriggerColor(transition.triggerType ?? 0)}>
            {getTriggerLabel(transition.triggerType ?? 0)}
          </Badge>
          {triggerKindLabel && (
            <Badge className="bg-muted text-muted-foreground">{triggerKindLabel}</Badge>
          )}
          <span className="text-muted-foreground text-[11px]">
            from <span className="font-mono font-semibold">{sourceKey}</span>
          </span>
        </div>
      </div>

      {/* Dialogs */}
      <TransitionDialogsHost
        mutations={mutations}
        findTransition={findTransition}
        dialogState={dialogState}
        getTransitions={getTransitions}
      />

      {/* Content: reuse TransitionCard */}
      <div className="flex-1 overflow-y-auto p-3">
        <TransitionCard
          transition={transition}
          index={effectiveIndex}
          currentStateKey={sourceKey}
          allStateKeys={mutations.allStateKeys}
          onUpdate={mutations.updateTransition}
          onRemove={() => {}}
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
          onOpenSchemaPicker={openers.openSchemaPicker}
          onOpenSchemaCreator={openers.openSchemaCreator}
          onOpenTaskPicker={openers.openTaskPicker}
          onOpenTaskCreator={openers.openTaskCreator}
          onOpenViewPicker={openers.openViewPicker}
          onOpenViewCreator={openers.openViewCreator}
          onOpenExtensionPicker={openers.openExtensionPicker}
          canPickExisting={mutations.canPickExisting}
          projectDomain={mutations.projectDomain}
          standalone
        />
      </div>
    </div>
  );
}
