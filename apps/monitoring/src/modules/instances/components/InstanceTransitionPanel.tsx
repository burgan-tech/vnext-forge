import { InfoRow, Section } from '@vnext-forge-studio/designer-ui';
import type { InstanceTimelineResponse } from '@monitoring/shared/types/instance-api';

interface InstanceTransitionPanelProps {
  timeline: InstanceTimelineResponse | null;
  transitionKey: string;
}

/** Execution overlay for a transition — rendered inside TransitionInspector's slot. */
export function InstanceTransitionPanel({ timeline, transitionKey }: InstanceTransitionPanelProps) {
  const fires = timeline?.transitions.filter((t) => t.transitionId === transitionKey) ?? [];

  return (
    <Section title="Execution" defaultOpen>
      {fires.length === 0 ? (
        <div className="text-muted-foreground py-2 text-[12px]">Not traversed</div>
      ) : (
        <div className="space-y-3">
          <InfoRow label="Traversed" value={`${fires.length}×`} />
          {fires.map((fire, index) => (
            <div key={index} className="space-y-1.5">
              {fires.length > 1 && (
                <div className="text-muted-foreground text-[11px] font-semibold">Fire {index + 1}</div>
              )}
              {fire.startedAt && (
                <InfoRow label="Started at" value={new Date(fire.startedAt).toLocaleString()} />
              )}
              {fire.durationSeconds != null && (
                <InfoRow label="Duration" value={`${fire.durationSeconds.toFixed(1)}s`} />
              )}
              {fire.triggerType && (
                <InfoRow label="Trigger" value={fire.triggerType} />
              )}
              {fire.createdBy && (
                <InfoRow label="Created by" value={fire.createdBy} />
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
