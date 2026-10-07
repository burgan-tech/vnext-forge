import { findState, findTransition } from '../../canvas-interaction/readonly/normalize';
import { StateInspector } from '../../canvas-interaction/readonly/StateInspector';
import { TransitionInspector } from '../../canvas-interaction/readonly/TransitionInspector';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { DataHistoryItem } from '../../quick-run/QuickRunApi';
import type { ElementMetricsLoader } from '../../quick-run/components/ElementMetrics';
import type { CorrelationTreeNode, HistoryTransition, TaskHistoryItem } from '../../quick-run/types/quickrun.types';
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
  /** Children started from the selected state. */
  childInstances?: CorrelationTreeNode[];
  onDrill?: (node: CorrelationTreeNode) => void;
  /** Button label for a child instance; defaults to "Drill into". */
  drillLabel?: string;
  /** Data rows attributed to each firing, and all loaded rows (newest first). */
  dataRowsByFiring?: Map<string, DataHistoryItem[]>;
  allDataRows?: DataHistoryItem[];
  dataHasNext?: boolean;
  onClose: () => void;
}

const hint = (text: string) => (
  <p className="px-3 py-8 text-center text-[11px] text-[var(--vscode-descriptionForeground,#9d9d9d)]">{text}</p>
);

/** Definition layer of the selected element, with one line of execution context. */
export function MonitorInspector({ vm, history, currentState, selection, tasks, loadMetrics, childInstances, onDrill, drillLabel, dataRowsByFiring, allDataRows, dataHasNext, onClose }: MonitorInspectorProps) {
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
        {childInstances && childInstances.length > 0 && onDrill && (
          <section aria-label="Child instances" className="flex flex-col gap-1 px-3 py-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--vscode-descriptionForeground,#9d9d9d)]">Child instances</h4>
            {childInstances.map((node) => (
              <div key={node.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{`${node.flow} · ${node.ownState ?? node.currentState ?? ''}`}</span>
                <button
                  type="button"
                  onClick={() => onDrill(node)}
                  className="shrink-0 cursor-pointer rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-0.5 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]"
                >
                  {drillLabel ?? 'Drill into'}
                </button>
              </div>
            ))}
          </section>
        )}
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
      <TransitionExecution firings={transitionFirings(history, selection.key)} tasks={tasks}
        {...(loadMetrics ? { loadMetrics } : {})}
        {...(dataRowsByFiring ? { dataRowsByFiring } : {})}
        {...(allDataRows ? { allRows: allDataRows } : {})}
        {...(dataHasNext ? { dataHasNext } : {})}
      />
    </TransitionInspector>
  );
}
