import { X } from 'lucide-react';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import type { WorkflowDefState, WorkflowDefTransition } from '@monitoring/shared/types/definitions-api';

const STATE_TYPE_LABELS: Record<number, string> = {
  1: 'Initial', 2: 'Intermediate', 3: 'Finish', 4: 'SubFlow', 5: 'Wizard',
};

const STATE_TYPE_VARIANTS: Record<number, 'info' | 'secondary' | 'success' | 'warning' | 'muted'> = {
  1: 'info', 2: 'secondary', 3: 'success', 4: 'warning', 5: 'muted',
};

const TRIGGER_TYPE_LABELS: Record<number, string> = {
  0: 'Manual', 1: 'Automatic', 2: 'Scheduled', 3: 'Event',
};

interface MonitoringStatePanelProps {
  state: WorkflowDefState;
  transitions: WorkflowDefTransition[];
  onClose: () => void;
  children?: React.ReactNode;
}

export function MonitoringStatePanel({ state, transitions, onClose, children }: MonitoringStatePanelProps) {
  const label = state.labels?.find((l) => l.language.startsWith('en'))?.label
    ?? state.labels?.[0]?.label;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">State</span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="font-mono text-base font-semibold text-foreground">{state.key}</p>
          {label && <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={STATE_TYPE_VARIANTS[state.type] ?? 'secondary'}>
            {STATE_TYPE_LABELS[state.type] ?? `Type ${state.type}`}
          </Badge>
        </div>

        {transitions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outgoing Transitions
            </p>
            <ul className="flex flex-col gap-1.5">
              {transitions.map((t) => (
                <li key={t.key} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <p className="font-mono font-medium text-foreground">{t.key}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    → <span className="font-mono">{t.to}</span>
                    {t.triggerType !== undefined && (
                      <span className={cn('ml-2 rounded px-1 py-0.5 text-[10px]', 'bg-muted text-muted-foreground')}>
                        {TRIGGER_TYPE_LABELS[t.triggerType] ?? t.triggerType}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Slot for execution-specific content (InstanceStatePanel extends this) */}
        {children}
      </div>
    </div>
  );
}
