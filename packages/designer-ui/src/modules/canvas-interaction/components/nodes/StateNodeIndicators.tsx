import { RadioTower } from 'lucide-react';
import { longPollTooltip, type InteractionNodeData } from '../../utils/stateNodeData';

/** Stats-row mini icon: the state holds long polls (C5). */
export function LongPollIndicator(props: Partial<InteractionNodeData>) {
  if (!props.hasLongPoll) return null;
  const label = longPollTooltip({ ...props, hasLongPoll: true });
  return (
    <span className="text-initial inline-flex items-center" title={label} aria-label={label}>
      <RadioTower size={11} strokeWidth={2.25} />
    </span>
  );
}

// Controller ruling F2: the missing-queryRoles warning keeps the
// workflow-root fallback, so the message must say the fallback can still
// satisfy the gate — a parent subflow overriding this state's queryRoles is
// one such source (see the subflow override surface).
export const HUMAN_TASK_GATE_MISSING_LABEL =
  'Human task without queryRoles — the human-task list shows it to nobody, unless a parent subflow overrides queryRoles for this state';

/** Corner dot on the icon stamp: a human task no caller can see (C4). */
export function HumanTaskGateDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      role="img"
      className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning-icon ring-2 ring-surface"
      title={HUMAN_TASK_GATE_MISSING_LABEL}
      aria-label={HUMAN_TASK_GATE_MISSING_LABEL}
    />
  );
}
