import { InfoRow, Section } from '@vnext-forge-studio/designer-ui';
import type { InstanceTimelineResponse } from '@monitoring/shared/types/instance-api';

interface InstanceStatePanelProps {
  timeline: InstanceTimelineResponse | null;
  currentState: string;
  stateKey: string;
}

/** Execution overlay for a state — rendered inside StateInspector's slot. */
export function InstanceStatePanel({ timeline, currentState, stateKey }: InstanceStatePanelProps) {
  const isCurrent = currentState === stateKey;

  // Arrivals: transitions where this state was entered.
  const toTransitions = timeline?.transitions.filter((t) => t.toState === stateKey) ?? [];
  // Departures: transitions where this state was exited.
  const fromTransitions = timeline?.transitions.filter((t) => t.fromState === stateKey) ?? [];

  // Visit count = number of arrivals.
  const visits = toTransitions.length;

  // First entry: earliest startedAt among arrivals (covers active state with no departure yet).
  const firstEntry =
    toTransitions.length > 0
      ? toTransitions.reduce((a, b) => (a.startedAt < b.startedAt ? a : b)).startedAt
      : null;

  // Last exit: latest finishedAt among departures.
  const lastExit =
    fromTransitions.length > 0
      ? (fromTransitions.reduce((a, b) => ((a.finishedAt ?? '') > (b.finishedAt ?? '') ? a : b)).finishedAt ?? null)
      : null;

  const status = isCurrent ? 'Current' : visits > 0 ? 'Visited' : 'Not reached';

  return (
    <Section title="Execution" defaultOpen>
      <div className="space-y-1.5">
        <InfoRow label="Status" value={status} />
        <InfoRow label="Visits" value={String(visits)} />
        {firstEntry && <InfoRow label="First entry" value={new Date(firstEntry).toLocaleString()} />}
        {lastExit && <InfoRow label="Last exit" value={new Date(lastExit).toLocaleString()} />}
      </div>
    </Section>
  );
}
