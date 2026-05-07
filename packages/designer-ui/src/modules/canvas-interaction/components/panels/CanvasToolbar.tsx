import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Wand2, Play, Square, CheckCircle2, XCircle,
  StopCircle, PauseCircle, Repeat2, ChevronDown, Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/Tooltip';
import {
  useCanvasViewSettings,
  type LayoutAlgorithm,
  type LayoutDirection,
  type EdgePathStyle,
} from '../../context/CanvasViewSettingsContext';

interface CanvasToolbarProps {
  onAddState: (stateType: number, subType: number) => void;
  onAutoLayout: () => void;
  workflowSettingsActive?: boolean;
  onToggleWorkflowSettings?: () => void;
  hasInitialState?: boolean;
  closeSignal?: number;
}

export function CanvasToolbar({
  onAddState,
  onAutoLayout,
  workflowSettingsActive,
  onToggleWorkflowSettings,
  hasInitialState,
  closeSignal,
}: CanvasToolbarProps) {
  const [open, setOpen] = useState(false);
  const [canvasOptionsOpen, setCanvasOptionsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canvasOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !canvasOptionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (canvasOptionsOpen && canvasOptionsRef.current && !canvasOptionsRef.current.contains(e.target as Node)) setCanvasOptionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, canvasOptionsOpen]);

  useEffect(() => {
    if (closeSignal && closeSignal > 0) {
      setOpen(false);
      setCanvasOptionsOpen(false);
    }
  }, [closeSignal]);

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
            <DropdownItem label="Initial State" icon={<Play size={14} />} color="text-initial" bg="bg-initial/10" onClick={() => add(1)} disabled={hasInitialState} />
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
        <span>Auto-Fix</span>
      </button>

      <div className="h-5 w-px bg-border" />

      {/* Canvas Options */}
      <div className="relative" ref={canvasOptionsRef}>
        <button
          onClick={() => setCanvasOptionsOpen(!canvasOptionsOpen)}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.97] ${
            canvasOptionsOpen
              ? 'border border-secondary-border bg-secondary-surface text-secondary-text'
              : 'border border-transparent text-muted-foreground hover:border-muted-border-hover hover:bg-muted hover:text-foreground'
          }`}
          aria-haspopup="true"
          aria-expanded={canvasOptionsOpen}
        >
          <SlidersHorizontal size={14} />
          <span>Canvas</span>
        </button>

        {canvasOptionsOpen && (
          <CanvasOptionsPanel onClose={() => setCanvasOptionsOpen(false)} />
        )}
      </div>

      {onToggleWorkflowSettings && (
        <>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleWorkflowSettings}
                    className={`shrink-0 rounded-xl p-1.5 transition-all duration-150 ${
                      workflowSettingsActive
                        ? 'border border-secondary-border bg-secondary-surface text-secondary-text'
                        : 'border border-transparent text-muted-foreground hover:border-muted-border-hover hover:bg-muted hover:text-foreground'
                    }`}
                    aria-label="Workflow Settings">
                    <Settings2 size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">
                  Workflow Settings
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Canvas Options Panel ───

function CanvasOptionsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useCanvasViewSettings();
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    const el = panelRef.current;
    if (el) {
      const firstFocusable = el.querySelector<HTMLElement>('button, [tabindex], input');
      firstFocusable?.focus();
    }
  }, []);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Canvas options"
      onKeyDown={handleKeyDown}
      className="absolute bottom-full mb-2.5 right-0 w-72 bg-surface/95 backdrop-blur-xl rounded-2xl border border-border shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)] py-3 animate-scale-in origin-bottom"
    >
      <div className="px-4 pb-2">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-widest">Canvas Options</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">Not saved to the workflow file.</p>
      </div>

      {/* Layout Engine */}
      <OptionSection title="Auto-layout Engine">
        <SegmentedControl<LayoutAlgorithm>
          value={settings.algorithm}
          onChange={(v) => updateSettings({ algorithm: v })}
          options={[
            { value: 'dagre', label: 'Dagre' },
            { value: 'elk', label: 'ELK' },
          ]}
        />
      </OptionSection>

      {/* Flow Direction */}
      <OptionSection title="Flow Direction">
        <SegmentedControl<LayoutDirection>
          value={settings.direction}
          onChange={(v) => updateSettings({ direction: v })}
          options={[
            { value: 'DOWN', label: 'Top to bottom' },
            { value: 'RIGHT', label: 'Left to right' },
          ]}
        />
      </OptionSection>

      {/* Edge Path */}
      <OptionSection title="Edge Path">
        <SegmentedControl<EdgePathStyle>
          value={settings.edgePathStyle}
          onChange={(v) => updateSettings({ edgePathStyle: v })}
          options={[
            { value: 'smoothstep', label: 'Smooth step' },
            { value: 'bezier', label: 'Curved' },
            { value: 'straight', label: 'Straight' },
          ]}
        />
      </OptionSection>

      {/* Workflow Edges Visibility */}
      <OptionSection title="Workflow Edges">
        <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground">
          <input
            type="checkbox"
            checked={settings.showWorkflowEdges}
            onChange={(e) => updateSettings({ showWorkflowEdges: e.target.checked })}
            className="size-3.5 cursor-pointer rounded accent-[var(--color-action)]"
          />
          Show workflow-level edges
        </label>
      </OptionSection>
    </div>
  );
}

// ─── Shared UI pieces ───

function OptionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
        {title}
      </label>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5 gap-0.5" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 cursor-pointer ${
            value === opt.value
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DropdownItem({ label, icon, color, bg, indent, onClick, disabled }: {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  indent?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2.5 transition-colors ${indent ? 'pl-7' : ''} ${
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed opacity-50'
          : 'text-foreground hover:bg-muted-surface cursor-pointer'
      }`}
    >
      <span className={`size-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <span className={color}>{icon}</span>
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
