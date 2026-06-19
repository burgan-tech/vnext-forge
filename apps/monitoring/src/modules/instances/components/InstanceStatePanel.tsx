import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { MonitoringStatePanel } from '@monitoring/modules/definitions/workflow/MonitoringStatePanel';
import type { WorkflowDefState, WorkflowDefTransition } from '@monitoring/shared/types/definitions-api';
import type { InstanceTimelineResponse } from '@monitoring/shared/types/instance-api';

interface InstanceStatePanelProps {
  state: WorkflowDefState;
  transitions: WorkflowDefTransition[];
  timeline: InstanceTimelineResponse | null;
  currentState: string;
  onClose: () => void;
}

export function InstanceStatePanel({
  state,
  transitions,
  timeline,
  currentState,
  onClose,
}: InstanceStatePanelProps) {
  const isCurrent = state.key === currentState;
  const visitCount = timeline
    ? timeline.transitions.filter((t) => t.fromState === state.key || t.toState === state.key).length
    : 0;

  const fromTransitions = timeline?.transitions.filter((t) => t.fromState === state.key) ?? [];
  const firstEntry =
    fromTransitions.length > 0
      ? fromTransitions.reduce((a, b) => (a.startedAt < b.startedAt ? a : b)).startedAt
      : null;
  const lastExit =
    fromTransitions.length > 0
      ? (fromTransitions.reduce((a, b) =>
          (a.finishedAt ?? '') > (b.finishedAt ?? '') ? a : b,
        ).finishedAt ?? null)
      : null;

  const executionStatus = isCurrent ? 'current' : visitCount > 0 ? 'visited' : 'unreachable';

  const STATUS_VARIANTS: Record<string, 'info' | 'secondary' | 'muted'> = {
    current: 'info',
    visited: 'secondary',
    unreachable: 'muted',
  };
  const STATUS_LABELS: Record<string, string> = {
    current: 'Current',
    visited: 'Visited',
    unreachable: 'Not reached',
  };

  return (
    <MonitoringStatePanel state={state} transitions={transitions} onClose={onClose}>
      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Execution
        </p>

        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANTS[executionStatus]}>
            {STATUS_LABELS[executionStatus]}
          </Badge>
        </div>

        {visitCount > 0 && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Visit count</span>
              <span className="font-mono text-foreground">{visitCount}</span>
            </div>
            {firstEntry && (
              <div className="flex justify-between">
                <span>First entry</span>
                <span className="font-mono text-foreground">
                  {new Date(firstEntry).toLocaleTimeString()}
                </span>
              </div>
            )}
            {lastExit && (
              <div className="flex justify-between">
                <span>Last exit</span>
                <span className="font-mono text-foreground">
                  {new Date(lastExit).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </MonitoringStatePanel>
  );
}
