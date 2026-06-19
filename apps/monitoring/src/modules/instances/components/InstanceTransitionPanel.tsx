import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { MonitoringTransitionPanel } from '@monitoring/modules/definitions/workflow/MonitoringTransitionPanel';
import type { WorkflowDefTransition } from '@monitoring/shared/types/definitions-api';
import type { InstanceTimelineResponse, TimelineTransition } from '@monitoring/shared/types/instance-api';

interface InstanceTransitionPanelProps {
  transition: WorkflowDefTransition;
  timeline: InstanceTimelineResponse | null;
  onClose: () => void;
}

export function InstanceTransitionPanel({ transition, timeline, onClose }: InstanceTransitionPanelProps) {
  const executions: TimelineTransition[] = timeline
    ? timeline.transitions.filter((t) => t.transitionId === transition.key)
    : [];

  const isTraversed = executions.length > 0;

  return (
    <MonitoringTransitionPanel transition={transition} onClose={onClose}>
      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Execution
        </p>

        <div className="flex items-center gap-2">
          <Badge variant={isTraversed ? 'success' : 'muted'}>
            {isTraversed ? `Traversed (${executions.length}×)` : 'Not taken'}
          </Badge>
        </div>

        {executions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {executions.map((e, i) => (
              <div key={e.id} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Run {i + 1}</span>
                  {e.durationSeconds != null && (
                    <span className="text-muted-foreground">{e.durationSeconds.toFixed(1)}s</span>
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                  <span>{new Date(e.startedAt).toLocaleString()}</span>
                  <span>
                    {e.triggerType} · {e.createdBy}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MonitoringTransitionPanel>
  );
}
