import type { ReactNode } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { TransitionView } from './view-types';
import { Badge } from '../components/panels/tabs/PropertyPanelShared';
import { getTriggerLabel } from '../components/panels/tabs/PropertyPanelHelpers';
import { TransitionFields } from './TransitionFields';

export interface TransitionInspectorProps {
  transition: TransitionView;
  onClose?: () => void;
  /** Slot for execution-overlay content (instance view). */
  children?: ReactNode;
}

export function TransitionInspector({ transition, onClose, children }: TransitionInspectorProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-border-subtle bg-surface px-3 py-2">
        <div className="bg-initial/10 flex size-6 shrink-0 items-center justify-center rounded-lg">
          <ArrowRight size={12} className="text-initial" />
        </div>
        <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[13px] font-bold tracking-tight">
          {transition.isStart ? 'Start transition' : transition.key || 'unnamed'}
        </span>
        {transition.triggerType != null && (
          <Badge className="bg-muted text-muted-foreground">{getTriggerLabel(transition.triggerType)}</Badge>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1 transition-colors"
            aria-label="Close panel">
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {transition.from && !transition.isStart && (
          <div className="text-muted-foreground text-[11px]">from <span className="font-mono">{transition.from}</span></div>
        )}
        <TransitionFields transition={transition} />
        {children}
      </div>
    </div>
  );
}
