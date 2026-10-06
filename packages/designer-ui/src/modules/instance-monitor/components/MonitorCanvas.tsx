import { useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { FlowCanvas } from '../../canvas-interaction/FlowCanvas';
import type { WorkflowViewModel } from '../../canvas-interaction/readonly/view-types';
import type { HistoryTransition } from '../../quick-run/types/quickrun.types';
import { toExecutionOverlay } from '../model/monitorPath';
import type { MonitorSelection } from '../types';

export interface MonitorCanvasProps {
  vm: WorkflowViewModel;
  diagram: Record<string, unknown>;
  history: readonly HistoryTransition[];
  currentState: string | null;
  pathOnly: boolean;
  /** Shared selection — spotlighted on the canvas when it came from elsewhere. */
  selection: MonitorSelection;
  onSelect: (selection: MonitorSelection) => void;
}

/** The flow in `instance-view`: the path on top of the local (or history-only) definition. */
export function MonitorCanvas({ vm, diagram, history, currentState, pathOnly, selection, onSelect }: MonitorCanvasProps) {
  const overlay = useMemo(
    () => toExecutionOverlay(history, currentState, pathOnly, selection),
    [history, currentState, pathOnly, selection],
  );
  return (
    <ReactFlowProvider>
      <FlowCanvas
        workflowJson={vm.workflowJson}
        diagramJson={diagram}
        mode="instance-view"
        executionOverlay={overlay}
        onNodeSelect={(key) => onSelect(key && key !== '__start__' && !key.startsWith('__wf_') ? { kind: 'state', key } : null)}
        onEdgeSelect={(key) => onSelect(key ? { kind: 'transition', key } : null)}
      />
    </ReactFlowProvider>
  );
}
