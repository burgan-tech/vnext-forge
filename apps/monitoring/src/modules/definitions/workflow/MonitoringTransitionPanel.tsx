import { X } from 'lucide-react';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';
import type { WorkflowDefTransition } from '@monitoring/shared/types/definitions-api';

const TRIGGER_TYPE_LABELS: Record<number, string> = {
  0: 'Manual', 1: 'Automatic', 2: 'Scheduled', 3: 'Event',
};

const TRIGGER_VARIANTS: Record<number, 'secondary' | 'info' | 'warning' | 'muted'> = {
  0: 'secondary', 1: 'info', 2: 'warning', 3: 'muted',
};

interface MonitoringTransitionPanelProps {
  transition: WorkflowDefTransition;
  onClose: () => void;
  children?: React.ReactNode;
}

export function MonitoringTransitionPanel({ transition, onClose, children }: MonitoringTransitionPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Transition</span>
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
          <p className="font-mono text-base font-semibold text-foreground">{transition.key}</p>
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-12 text-xs text-muted-foreground">From</span>
            <span className="font-mono text-foreground">{transition.from}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-12 text-xs text-muted-foreground">To</span>
            <span className="font-mono text-foreground">{transition.to}</span>
          </div>
        </div>

        {transition.triggerType !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Trigger</span>
            <Badge variant={TRIGGER_VARIANTS[transition.triggerType] ?? 'secondary'}>
              {TRIGGER_TYPE_LABELS[transition.triggerType] ?? `Type ${transition.triggerType}`}
            </Badge>
          </div>
        )}

        {/* Slot for execution-specific content (InstanceTransitionPanel extends this) */}
        {children}
      </div>
    </div>
  );
}
