import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Wand2, Play, Square, CheckCircle2, XCircle,
  StopCircle, PauseCircle, Repeat2, ChevronDown, Settings2,
  SlidersHorizontal, Search, RotateCcw, Download, Image as ImageIcon,
  Maximize,
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
  type SizeStep,
  type BackgroundStyle,
  type DensityStep,
  type GridSize,
  type NodeDensity,
  type StatsVisibility,
  type PulseAnimation,
  type CanvasDragMode,
} from '../../context/CanvasViewSettingsContext';

interface CanvasToolbarProps {
  onAddState: (stateType: number, subType: number) => void;
  onAutoLayout: () => void;
  onOpenSearch?: () => void;
  workflowSettingsActive?: boolean;
  onToggleWorkflowSettings?: () => void;
  hasInitialState?: boolean;
  closeSignal?: number;
  /** Trigger a PNG export of the canvas. */
  onExportPng?: () => void;
  /** Trigger an SVG export of the canvas. */
  onExportSvg?: () => void;
  /** Enter Presentation Mode (chrome hidden). */
  onEnterPresentation?: () => void;
}

export function CanvasToolbar({
  onAddState,
  onAutoLayout,
  onOpenSearch,
  workflowSettingsActive,
  onToggleWorkflowSettings,
  hasInitialState,
  closeSignal,
  onExportPng,
  onExportSvg,
  onEnterPresentation,
}: CanvasToolbarProps) {
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [canvasOptionsOpen, setCanvasOptionsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const canvasOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !canvasOptionsOpen && !exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (exportOpen && exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (canvasOptionsOpen && canvasOptionsRef.current && !canvasOptionsRef.current.contains(e.target as Node)) setCanvasOptionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, exportOpen, canvasOptionsOpen]);

  useEffect(() => {
    if (closeSignal && closeSignal > 0) {
      setOpen(false);
      setExportOpen(false);
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

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenSearch}
              className="text-muted-foreground hover:bg-muted flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.97]"
              aria-label="Search states and transitions"
            >
              <Search size={14} className="text-muted-icon" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px]">
            <span>Search</span>
            <kbd className="ml-1.5 rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">
              {typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}+F
            </kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Export dropdown + Presentation Mode */}
      {(onExportPng || onExportSvg || onEnterPresentation) && (
        <>
          <div className="h-5 w-px bg-border" />

          {(onExportPng || onExportSvg) && (
            <div className="relative" ref={exportRef}>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setExportOpen(!exportOpen)}
                      className="text-muted-foreground hover:bg-muted flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all duration-150 active:scale-[0.97]"
                      aria-label="Export canvas"
                      aria-haspopup="true"
                      aria-expanded={exportOpen}
                    >
                      <Download size={14} className="text-muted-icon" />
                    </button>
                  </TooltipTrigger>
                  {!exportOpen && (
                    <TooltipContent side="top" className="text-[11px]">Export</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {exportOpen && (
                <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-xl rounded-2xl border border-border shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)] py-2 min-w-44 animate-scale-in">
                  {onExportPng && (
                    <DropdownItem
                      label="Export PNG"
                      icon={<ImageIcon size={14} />}
                      color="text-muted-foreground"
                      bg="bg-muted"
                      onClick={() => { onExportPng(); setExportOpen(false); }}
                    />
                  )}
                  {onExportSvg && (
                    <DropdownItem
                      label="Export SVG"
                      icon={<Download size={14} />}
                      color="text-muted-foreground"
                      bg="bg-muted"
                      onClick={() => { onExportSvg(); setExportOpen(false); }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {onEnterPresentation && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onEnterPresentation}
                    className="text-muted-foreground hover:bg-muted flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all duration-150 active:scale-[0.97]"
                    aria-label="Enter presentation mode"
                  >
                    <Maximize size={14} className="text-muted-icon" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px]">Presentation Mode</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}

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
  const { settings, updateSettings, resetSettings } = useCanvasViewSettings();
  const panelRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<'layout' | 'customize'>('layout');

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

  const handleReset = useCallback(() => {
    if (window.confirm('Reset all canvas view settings to defaults?')) {
      resetSettings();
    }
  }, [resetSettings]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Canvas options"
      onKeyDown={handleKeyDown}
      className="absolute bottom-full mb-2.5 right-0 w-80 bg-surface/95 backdrop-blur-xl rounded-2xl border border-border shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)] py-3 animate-scale-in origin-bottom max-h-[70vh] overflow-y-auto"
    >
      <div className="px-4 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-widest">Canvas Options</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Saved to your local browser — not committed to the workflow file.
          </p>
        </div>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleReset}
                className="shrink-0 rounded-md border border-border bg-surface p-1 text-muted-foreground hover:text-foreground hover:border-muted-border-hover transition-all"
                aria-label="Reset all canvas view settings to defaults"
              >
                <RotateCcw size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px]">Reset to defaults</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Section switcher — Layout vs Customize. Strong border +
       * higher contrast active state so the tabs read clearly in
       * both light AND dark themes (the default `bg-muted` /
       * `bg-surface` pair was too close in dark mode and the
       * switcher visually disappeared). */}
      <div className="px-4 pb-2">
        <div
          className="flex rounded-lg border border-border bg-muted-surface p-0.5 gap-0.5"
          role="tablist"
        >
          <button
            role="tab"
            aria-selected={section === 'layout'}
            onClick={() => setSection('layout')}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              section === 'layout'
                ? 'bg-action text-action-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Layout
          </button>
          <button
            role="tab"
            aria-selected={section === 'customize'}
            onClick={() => setSection('customize')}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
              section === 'customize'
                ? 'bg-action text-action-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Customize
          </button>
        </div>
      </div>

      {section === 'layout' ? (
        <>
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

          {/* Focus Mode */}
          <OptionSection title="Focus Mode">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={settings.focusMode}
                onChange={(e) => updateSettings({ focusMode: e.target.checked })}
                className="size-3.5 cursor-pointer rounded accent-[var(--color-action)]"
              />
              Dim unrelated nodes when one is selected
            </label>
          </OptionSection>
        </>
      ) : (
        <>
          {/* ── Edges ───────────────────────────────────────────── */}
          <SectionDivider label="Edges" />

          <OptionSection title="Stroke Thickness">
            <SegmentedControl<SizeStep>
              value={settings.edgeStroke}
              onChange={(v) => updateSettings({ edgeStroke: v })}
              options={[
                { value: 'sm', label: 'Thin' },
                { value: 'md', label: 'Normal' },
                { value: 'lg', label: 'Thick' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Arrow Size">
            <SegmentedControl<SizeStep>
              value={settings.arrowSize}
              onChange={(v) => updateSettings({ arrowSize: v })}
              options={[
                { value: 'sm', label: 'Compact' },
                { value: 'md', label: 'Normal' },
                { value: 'lg', label: 'Large' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Label Size">
            <SegmentedControl<SizeStep>
              value={settings.labelSize}
              onChange={(v) => updateSettings({ labelSize: v })}
              options={[
                { value: 'sm', label: 'Small' },
                { value: 'md', label: 'Normal' },
                { value: 'lg', label: 'Large' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Self-Loop Size">
            <SegmentedControl<SizeStep>
              value={settings.selfLoopSize}
              onChange={(v) => updateSettings({ selfLoopSize: v })}
              options={[
                { value: 'sm', label: 'Compact' },
                { value: 'md', label: 'Normal' },
                { value: 'lg', label: 'Spacious' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Animated Dashes">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={settings.animatedEdges}
                onChange={(e) => updateSettings({ animatedEdges: e.target.checked })}
                className="size-3.5 cursor-pointer rounded accent-[var(--color-action)]"
              />
              Animate auto / scheduled / event edges
            </label>
          </OptionSection>

          {/* ── Selection Pulse ──────────────────────────────────── */}
          <SectionDivider label="Selection Pulse" />

          <OptionSection title="Pulse on Click">
            <SegmentedControl<PulseAnimation>
              value={settings.pulseAnimation}
              onChange={(v) => updateSettings({ pulseAnimation: v })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'single-hop', label: 'Direct' },
                { value: 'wave', label: 'Wave' },
                { value: 'reachability', label: 'Reach →' },
                { value: 'reverse-reachability', label: '← Reach' },
              ]}
            />
            <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
              <strong>Direct</strong>: pulse only the directly-connected edges.{' '}
              <strong>Wave</strong>: ripple out hop-by-hop with a stagger.{' '}
              <strong>Reach →</strong>: every state reachable downstream.{' '}
              <strong>← Reach</strong>: every state that can reach this one (predecessors).
            </p>
          </OptionSection>

          {/* ── Multi-Select ────────────────────────────────────── */}
          <OptionSection title="Multi-Select">
            <div className="rounded-md border border-border bg-muted-surface p-2 text-[10px] text-muted-foreground leading-relaxed">
              <div className="mb-1 font-semibold text-foreground">Built-in shortcuts</div>
              <ul className="space-y-0.5">
                <li>
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
                    ⌘
                  </kbd>{' '}
                  /{' '}
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
                    Ctrl
                  </kbd>{' '}
                  + click — add a node to the selection
                </li>
                <li>
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
                    Shift
                  </kbd>{' '}
                  + drag on empty canvas — rubber-band rectangle
                </li>
                <li>Right-click on empty canvas — add state or sticky note</li>
              </ul>
            </div>
          </OptionSection>

          {/* ── Nodes ───────────────────────────────────────────── */}
          <SectionDivider label="Nodes" />

          <OptionSection title="Density">
            <SegmentedControl<NodeDensity>
              value={settings.nodeDensity}
              onChange={(v) => updateSettings({ nodeDensity: v })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Icon Stamp">
            <SegmentedControl<SizeStep>
              value={settings.iconSize}
              onChange={(v) => updateSettings({ iconSize: v })}
              options={[
                { value: 'sm', label: 'Small' },
                { value: 'md', label: 'Medium' },
                { value: 'lg', label: 'Large' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Stats Row">
            <SegmentedControl<StatsVisibility>
              value={settings.statsVisibility}
              onChange={(v) => updateSettings({ statsVisibility: v })}
              options={[
                { value: 'always', label: 'Always' },
                { value: 'hover', label: 'On hover' },
                { value: 'never', label: 'Never' },
              ]}
            />
          </OptionSection>

          {/* ── Canvas ──────────────────────────────────────────── */}
          <SectionDivider label="Canvas" />

          <OptionSection title="Background">
            <SegmentedControl<BackgroundStyle>
              value={settings.backgroundStyle}
              onChange={(v) => updateSettings({ backgroundStyle: v })}
              options={[
                { value: 'dots', label: 'Dots' },
                { value: 'lines', label: 'Lines' },
                { value: 'none', label: 'None' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Background Density">
            <SegmentedControl<DensityStep>
              value={settings.backgroundDensity}
              onChange={(v) => updateSettings({ backgroundDensity: v })}
              options={[
                { value: 'sparse', label: 'Sparse' },
                { value: 'normal', label: 'Normal' },
                { value: 'dense', label: 'Dense' },
              ]}
            />
          </OptionSection>

          <OptionSection title="Snap to Grid">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={settings.snapToGrid}
                onChange={(e) => updateSettings({ snapToGrid: e.target.checked })}
                className="size-3.5 cursor-pointer rounded accent-[var(--color-action)]"
              />
              Snap node positions to a grid
            </label>
          </OptionSection>

          {settings.snapToGrid && (
            <OptionSection title="Grid Size">
              <SegmentedControl<GridSize>
                value={settings.gridSize}
                onChange={(v) => updateSettings({ gridSize: v })}
                options={[
                  { value: 10 as GridSize, label: '10' },
                  { value: 20 as GridSize, label: '20' },
                  { value: 40 as GridSize, label: '40' },
                ]}
              />
            </OptionSection>
          )}

          {/* ── Zoom-aware ──────────────────────────────────────── */}
          <SectionDivider label="Zoom Behavior" />

          <OptionSection title="Hide Labels at Low Zoom">
            <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={settings.labelZoomHidden}
                onChange={(e) => updateSettings({ labelZoomHidden: e.target.checked })}
                className="mt-0.5 size-3.5 cursor-pointer rounded accent-[var(--color-action)]"
              />
              <span>
                Hide transition labels when zoom drops below 50%
                <span className="block text-[10px] font-normal text-muted-foreground">
                  Cleans up the canvas overview.
                </span>
              </span>
            </label>
          </OptionSection>

          <OptionSection title="Counter-Scale Labels">
            <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={settings.counterScaleLabels}
                onChange={(e) => updateSettings({ counterScaleLabels: e.target.checked })}
                className="mt-0.5 size-3.5 cursor-pointer rounded accent-[var(--color-action)]"
              />
              <span>
                Keep label font size constant on screen
                <span className="block text-[10px] font-normal text-muted-foreground">
                  Lucidchart-style: labels stay legible at any zoom.
                </span>
              </span>
            </label>
          </OptionSection>

          <OptionSection title="Non-Scaling Strokes">
            <label className="flex cursor-pointer items-start gap-2 text-[11px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={settings.nonScalingStrokes}
                onChange={(e) => updateSettings({ nonScalingStrokes: e.target.checked })}
                className="mt-0.5 size-3.5 cursor-pointer rounded accent-[var(--color-action)]"
              />
              <span>
                Edges keep their pixel thickness at every zoom level
                <span className="block text-[10px] font-normal text-muted-foreground">
                  Prevents lines from vanishing on zoom-out or bloating on zoom-in.
                </span>
              </span>
            </label>
          </OptionSection>
        </>
      )}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
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

function SegmentedControl<T extends string | number>({
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
          key={String(opt.value)}
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
