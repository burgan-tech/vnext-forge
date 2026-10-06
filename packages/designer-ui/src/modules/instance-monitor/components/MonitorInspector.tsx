import { findState, findTransition } from '../../canvas-interaction/readonly/normalize';
import { StateInspector } from '../../canvas-interaction/readonly/StateInspector';
import { TransitionInspector } from '../../canvas-interaction/readonly/TransitionInspector';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { ElementMetricsLoader } from '../../quick-run/components/ElementMetrics';
import type { HistoryTransition, TaskHistoryItem } from '../../quick-run/types/quickrun.types';
import { describeFirings, describeStateVisits, summarizeState, transitionFirings } from '../model/monitorPath';
import type { MonitorSelection } from '../types';
import { StateExecution } from './StateExecution';
import { TransitionExecution } from './TransitionExecution';

export interface MonitorInspectorProps {
  vm: WorkflowViewModel;
  history: readonly HistoryTransition[];
  currentState: string | null;
  selection: MonitorSelection;
  tasks: TaskHistoryItem[];
  loadMetrics?: ElementMetricsLoader;
  onClose: () => void;
}

const hint = (text: string) => (
  <p className="px-3 py-8 text-center text-[11px] text-[var(--vscode-descriptionForeground,#9d9d9d)]">{text}</p>
);

/** Definition layer of the selected element, with one line of execution context. */
export function MonitorInspector({ vm, history, currentState, selection, tasks, loadMetrics, onClose }: MonitorInspectorProps) {
  if (!selection) return hint('Select a state or transition on the canvas or in the path.');

  if (selection.kind === 'state') {
    const state = findState(vm, selection.key);
    if (!state) return hint(`State ${selection.key} is not in the local definition.`);
    return (
      <StateInspector
        state={state}
        onClose={onClose}
        summary={describeStateVisits(summarizeState(history, state.key, currentState))}
      >
        <StateExecution stateKey={state.key} tasks={tasks} {...(loadMetrics ? { loadMetrics } : {})} />
      </StateInspector>
    );
  }

  const transition = findTransition(vm, selection.key);
  if (!transition) return hint(`Transition ${selection.key} is not in the local definition.`);
  return (
    <TransitionInspector
      transition={transition}
      onClose={onClose}
      summary={describeFirings(transitionFirings(history, selection.key).length)}
    >
      <TransitionExecution firings={transitionFirings(history, selection.key)} tasks={tasks} {...(loadMetrics ? { loadMetrics } : {})} />
    </TransitionInspector>
  );
}
