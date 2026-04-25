import { useState, useRef, useEffect } from 'react';
import {
  Plus, Wand2, Play, Square, CheckCircle2, XCircle,
  StopCircle, PauseCircle, Repeat2, ChevronDown, Settings2,
} from 'lucide-react';
interface CanvasToolbarProps {
  onAddState: (stateType: number, subType: number) => void;
  onAutoLayout: () => void;
  workflowSettingsActive?: boolean;
  onToggleWorkflowSettings?: () => void;
}

export function CanvasToolbar({
  onAddState,
  onAutoLayout,
  workflowSettingsActive,
  onToggleWorkflowSettings,
}: CanvasToolbarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const add = (stateType: number, subType = 0) => {
    onAddState(stateType, subType);
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      className="fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-surface/90 px-2 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] backdrop-blur-xl bottom-[max(1.5rem,calc(var(--designer-host-status-bar-height,0px)+0.75rem))]">
      {/* Add State */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="bg-action text-action-foreground hover:bg-action-hover shadow-md hover:shadow-lg flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.97]"
          style={{ '--tw-shadow-color': 'var(--color-action-shadow)' } as React.CSSProperties}
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Add State</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute bottom-full mb-2.5 left-0 bg-surface/95 backdrop-blur-xl rounded-2xl border border-border shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)] py-2 min-w-55 animate-scale-in">
            <DropdownItem label="Initial State" icon={<Play size={14} />} color="text-initial" bg="bg-initial/10" onClick={() => add(1)} />
            <DropdownItem label="Intermediate" icon={<Square size={14} />} color="text-intermediate" bg="bg-intermediate/10" onClick={() => add(2)} />
            <div className="h-px bg-border-subtle my-1.5 mx-3" />
            <div className="px-3.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Final States</div>
            <DropdownItem label="Success" icon={<CheckCircle2 size={14} />} color="text-final-success" bg="bg-final-success/10" onClick={() => add(3, 1)} indent />
            <DropdownItem label="Error" icon={<XCircle size={14} />} color="text-final-error" bg="bg-final-error/10" onClick={() => add(3, 2)} indent />
            <DropdownItem label="Terminated" icon={<StopCircle size={14} />} color="text-final-terminated" bg="bg-final-terminated/10" onClick={() => add(3, 3)} indent />
            <DropdownItem label="Suspended" icon={<PauseCircle size={14} />} color="text-final-suspended" bg="bg-final-suspended/10" onClick={() => add(3, 4)} indent />
            <div className="h-px bg-border-subtle my-1.5 mx-3" />
            <DropdownItem label="SubFlow" icon={<Repeat2 size={14} />} color="text-subflow" bg="bg-subflow/10" onClick={() => add(4)} />
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-border" />

      <button
        onClick={onAutoLayout}
        className="text-muted-foreground hover:bg-muted flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.97]">
        <Wand2 size={14} className="text-muted-icon" />
        <span>Layout</span>
      </button>

      {onToggleWorkflowSettings && (
        <>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleWorkflowSettings}
              className={`shrink-0 rounded-xl p-1.5 transition-all duration-150 ${
                workflowSettingsActive
                  ? 'border border-secondary-border bg-secondary-surface text-secondary-text'
                  : 'border border-transparent text-muted-foreground hover:border-muted-border-hover hover:bg-muted hover:text-foreground'
              }`}
              title="Workflow Settings">
              <Settings2 size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DropdownItem({ label, icon, color, bg, indent, onClick }: {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  indent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2.5 text-foreground hover:bg-muted-surface transition-colors cursor-pointer ${indent ? 'pl-7' : ''}`}
    >
      <span className={`size-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <span className={color}>{icon}</span>
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
