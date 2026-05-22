import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';
import { useSettingsStore, type ColorThemePreference } from '../../../store/useSettingsStore.js';

// ─── Setting value enums ─────────────────────────────────────────────
export type LayoutAlgorithm = 'dagre' | 'elk';
export type LayoutDirection = 'DOWN' | 'RIGHT';
export type EdgePathStyle = 'smoothstep' | 'bezier' | 'straight';

// Visual tuning enums — three-step size scales are easier to reason
// about than free-form numbers and map cleanly to CSS class variants.
export type SizeStep = 'sm' | 'md' | 'lg';
export type BackgroundStyle = 'dots' | 'lines' | 'none';
export type DensityStep = 'sparse' | 'normal' | 'dense';
export type GridSize = 10 | 20 | 40;
export type NodeDensity = 'compact' | 'comfortable';
export type StatsVisibility = 'always' | 'hover' | 'never';
/**
 * Animation pattern triggered when the user selects a node:
 *  - `off`         — no animation
 *  - `single-hop`  — only the directly connected edges pulse for ~1.5s
 *  - `wave`        — BFS layers pulse with a stagger delay, like a
 *                    droplet rippling out from the source
 *  - `reachability` — every transitively-reachable edge stays
 *                    highlighted until selection changes (static)
 */
export type PulseAnimation =
  | 'off'
  | 'single-hop'
  | 'wave'
  | 'reachability'
  | 'reverse-reachability';
/**
 * Primary left-mouse drag action on the canvas:
 *  - `pan`    — drag the viewport (default; like a map)
 *  - `select` — drag a rectangle to select multiple nodes; pan
 *               falls back to middle / right mouse or two-finger
 *               scroll on trackpads
 */
export type CanvasDragMode = 'pan' | 'select';

export interface CanvasViewSettings {
  // ── Layout (existing) ──
  algorithm: LayoutAlgorithm;
  direction: LayoutDirection;
  edgePathStyle: EdgePathStyle;
  showWorkflowEdges: boolean;
  /**
   * Focus mode — when on, selecting a node or edge dims everything
   * else on the canvas. Pure CSS via `data-focus-mode="true"` on the
   * canvas wrapper + `:has()` selectors in `canvas-overrides.css`.
   */
  focusMode: boolean;

  // ── Edges (visual tuning) ──
  /** Stroke thickness step. Mapped to 1.5 / 2 / 2.75 px in render. */
  edgeStroke: SizeStep;
  /** Arrow head size step. Mapped to 7 / 10 / 14 px in `SharedEdgeMarkers`. */
  arrowSize: SizeStep;
  /** Label font size step. Mapped to 10 / 11 / 13 px in `TransitionEdge`. */
  labelSize: SizeStep;
  /** Animated dashes on auto/scheduled edges. Off by default. */
  animatedEdges: boolean;
  /** Self-loop physical size step. Maps to {70×45, 90×55, 120×75}. */
  selfLoopSize: SizeStep;

  // ── Nodes ──
  /** Compact = label + icon only, no stats row. Comfortable = full. */
  nodeDensity: NodeDensity;
  /** Icon stamp size step. Maps to size-8/10/12. */
  iconSize: SizeStep;
  /**
   * Stats row visibility:
   *  - `always`: show whenever stats exist
   *  - `hover`: show only when the node is hovered/selected
   *  - `never`: never show
   */
  statsVisibility: StatsVisibility;

  // ── Canvas chrome ──
  backgroundStyle: BackgroundStyle;
  backgroundDensity: DensityStep;
  /** Snap-to-grid toggle. */
  snapToGrid: boolean;
  /** Grid size (only meaningful when snapToGrid is on). */
  gridSize: GridSize;

  // ── Zoom-aware behavior ──
  /** Auto-hide labels when zoom drops below 0.5. */
  labelZoomHidden: boolean;
  /**
   * Counter-scale labels at high zoom so they keep a fixed
   * on-screen size instead of growing with the canvas.
   */
  counterScaleLabels: boolean;
  /**
   * Make edge strokes use `vector-effect: non-scaling-stroke` so
   * they keep their pixel thickness regardless of zoom. Helps at
   * low zoom (strokes don't vanish) and at high zoom (don't bloat).
   */
  nonScalingStrokes: boolean;

  // ── Selection feedback ──
  /** What happens visually when a node is selected. */
  pulseAnimation: PulseAnimation;

  // ── Canvas drag behavior ──
  /** Primary action when left-dragging on empty canvas. */
  dragMode: CanvasDragMode;
}

interface CanvasViewSettingsContextValue {
  settings: CanvasViewSettings;
  updateSettings: (patch: Partial<CanvasViewSettings>) => void;
  resetSettings: () => void;
}

const VALID_ALGORITHMS: readonly string[] = ['dagre', 'elk'];
const VALID_DIRECTIONS: readonly string[] = ['DOWN', 'RIGHT'];
const VALID_EDGE_STYLES: readonly string[] = ['smoothstep', 'bezier', 'straight'];
const VALID_THEMES: readonly string[] = ['dark', 'light', 'system'];
const VALID_SIZE_STEPS: readonly string[] = ['sm', 'md', 'lg'];
const VALID_BG_STYLES: readonly string[] = ['dots', 'lines', 'none'];
const VALID_DENSITIES: readonly string[] = ['sparse', 'normal', 'dense'];
const VALID_GRID_SIZES: readonly number[] = [10, 20, 40];
const VALID_NODE_DENSITIES: readonly string[] = ['compact', 'comfortable'];
const VALID_STATS_VIS: readonly string[] = ['always', 'hover', 'never'];
const VALID_PULSES: readonly string[] = [
  'off',
  'single-hop',
  'wave',
  'reachability',
  'reverse-reachability',
];
const VALID_DRAG_MODES: readonly string[] = ['pan', 'select'];

const defaultSettings: CanvasViewSettings = {
  algorithm: 'dagre',
  direction: 'DOWN',
  edgePathStyle: 'smoothstep',
  showWorkflowEdges: true,
  focusMode: false,

  edgeStroke: 'md',
  arrowSize: 'md',
  labelSize: 'md',
  animatedEdges: false,
  selfLoopSize: 'md',

  nodeDensity: 'comfortable',
  iconSize: 'md',
  statsVisibility: 'always',

  backgroundStyle: 'dots',
  backgroundDensity: 'normal',
  snapToGrid: true,
  gridSize: 20,

  labelZoomHidden: true,
  counterScaleLabels: false,
  nonScalingStrokes: true,

  pulseAnimation: 'wave',
  dragMode: 'pan',
};

const STORAGE_KEY = 'vnext.canvas.viewSettings.v1';

function applyThemeModeIfValid(themeMode: unknown): void {
  if (typeof themeMode === 'string' && VALID_THEMES.includes(themeMode)) {
    useSettingsStore.getState().setColorTheme(themeMode as ColorThemePreference);
  }
}

function applyAutoSaveIfPresent(value: unknown): void {
  if (typeof value === 'boolean') {
    useSettingsStore.getState().setAutoSaveEnabled(value);
  }
}

/**
 * Merge a partial settings object onto `prev`, validating each field
 * against its allowed value set. Unknown / mistyped fields fall back
 * to the previous value (or the default on first load), so a bad
 * localStorage entry can never crash the canvas.
 */
function mergeValidated(
  prev: CanvasViewSettings,
  patch: Record<string, unknown>,
): CanvasViewSettings {
  return {
    algorithm: VALID_ALGORITHMS.includes(patch.algorithm as string)
      ? (patch.algorithm as LayoutAlgorithm)
      : prev.algorithm,
    direction: VALID_DIRECTIONS.includes(patch.direction as string)
      ? (patch.direction as LayoutDirection)
      : prev.direction,
    edgePathStyle: VALID_EDGE_STYLES.includes(patch.edgePathStyle as string)
      ? (patch.edgePathStyle as EdgePathStyle)
      : prev.edgePathStyle,
    showWorkflowEdges:
      typeof patch.showWorkflowEdges === 'boolean' ? patch.showWorkflowEdges : prev.showWorkflowEdges,
    focusMode: typeof patch.focusMode === 'boolean' ? patch.focusMode : prev.focusMode,

    edgeStroke: VALID_SIZE_STEPS.includes(patch.edgeStroke as string)
      ? (patch.edgeStroke as SizeStep)
      : prev.edgeStroke,
    arrowSize: VALID_SIZE_STEPS.includes(patch.arrowSize as string)
      ? (patch.arrowSize as SizeStep)
      : prev.arrowSize,
    labelSize: VALID_SIZE_STEPS.includes(patch.labelSize as string)
      ? (patch.labelSize as SizeStep)
      : prev.labelSize,
    animatedEdges: typeof patch.animatedEdges === 'boolean' ? patch.animatedEdges : prev.animatedEdges,
    selfLoopSize: VALID_SIZE_STEPS.includes(patch.selfLoopSize as string)
      ? (patch.selfLoopSize as SizeStep)
      : prev.selfLoopSize,

    nodeDensity: VALID_NODE_DENSITIES.includes(patch.nodeDensity as string)
      ? (patch.nodeDensity as NodeDensity)
      : prev.nodeDensity,
    iconSize: VALID_SIZE_STEPS.includes(patch.iconSize as string)
      ? (patch.iconSize as SizeStep)
      : prev.iconSize,
    statsVisibility: VALID_STATS_VIS.includes(patch.statsVisibility as string)
      ? (patch.statsVisibility as StatsVisibility)
      : prev.statsVisibility,

    backgroundStyle: VALID_BG_STYLES.includes(patch.backgroundStyle as string)
      ? (patch.backgroundStyle as BackgroundStyle)
      : prev.backgroundStyle,
    backgroundDensity: VALID_DENSITIES.includes(patch.backgroundDensity as string)
      ? (patch.backgroundDensity as DensityStep)
      : prev.backgroundDensity,
    snapToGrid: typeof patch.snapToGrid === 'boolean' ? patch.snapToGrid : prev.snapToGrid,
    gridSize: VALID_GRID_SIZES.includes(patch.gridSize as number)
      ? (patch.gridSize as GridSize)
      : prev.gridSize,

    labelZoomHidden:
      typeof patch.labelZoomHidden === 'boolean' ? patch.labelZoomHidden : prev.labelZoomHidden,
    counterScaleLabels:
      typeof patch.counterScaleLabels === 'boolean' ? patch.counterScaleLabels : prev.counterScaleLabels,
    nonScalingStrokes:
      typeof patch.nonScalingStrokes === 'boolean' ? patch.nonScalingStrokes : prev.nonScalingStrokes,

    pulseAnimation: VALID_PULSES.includes(patch.pulseAnimation as string)
      ? (patch.pulseAnimation as PulseAnimation)
      : prev.pulseAnimation,
    dragMode: VALID_DRAG_MODES.includes(patch.dragMode as string)
      ? (patch.dragMode as CanvasDragMode)
      : prev.dragMode,
  };
}

function readFromLocalStorage(): Partial<CanvasViewSettings> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Partial<CanvasViewSettings>;
    }
  } catch {
    /* ignore corrupted storage */
  }
  return null;
}

function writeToLocalStorage(settings: CanvasViewSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/**
 * Resolution order: `localStorage` overrides host-injected
 * `window.__VNEXT_CONFIG__.canvasViewSettings`, which overrides
 * `defaultSettings`. This lets the embedding shell ship its own
 * baseline while still respecting per-user choices.
 */
function readInitialSettings(): CanvasViewSettings {
  let result = { ...defaultSettings };

  try {
    const config = (window as unknown as Record<string, unknown>).__VNEXT_CONFIG__ as
      | Record<string, unknown>
      | undefined;

    if (config?.themeMode) {
      applyThemeModeIfValid(config.themeMode);
    }
    if (config) {
      applyAutoSaveIfPresent(config.autoSaveEnabled);
    }

    if (config?.canvasViewSettings && typeof config.canvasViewSettings === 'object') {
      result = mergeValidated(result, config.canvasViewSettings as Record<string, unknown>);
    }
  } catch {
    /* ignore */
  }

  const local = readFromLocalStorage();
  if (local) {
    result = mergeValidated(result, local as Record<string, unknown>);
  }

  return result;
}

const CanvasViewSettingsContext = createContext<CanvasViewSettingsContextValue>({
  settings: defaultSettings,
  updateSettings: () => {},
  resetSettings: () => {},
});

export function CanvasViewSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CanvasViewSettings>(readInitialSettings);

  // Persist every settings change to localStorage so the user's
  // chrome survives a reload. We write the full settings object
  // (not just the patch) because the validator on read needs the
  // canonical shape.
  useEffect(() => {
    writeToLocalStorage(settings);
  }, [settings]);

  // Host-side updates (e.g. from the VS Code settings UI in the
  // extension shell) come in as `postMessage` events. They merge
  // on top of the current settings — the host shell can change
  // any subset without overwriting fields it doesn't care about.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as Record<string, unknown> | undefined;
      if (data?.type !== 'host:canvas-settings-changed') return;

      if (data.themeMode) {
        applyThemeModeIfValid(data.themeMode);
      }

      applyAutoSaveIfPresent(data.autoSaveEnabled);

      const incoming = data.canvasViewSettings as Record<string, unknown> | undefined;
      if (!incoming) return;

      setSettings((prev) => mergeValidated(prev, incoming));
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const value = useMemo<CanvasViewSettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) =>
        setSettings((prev) => mergeValidated(prev, patch as Record<string, unknown>)),
      resetSettings: () => setSettings({ ...defaultSettings }),
    }),
    [settings],
  );

  return (
    <CanvasViewSettingsContext.Provider value={value}>
      {children}
    </CanvasViewSettingsContext.Provider>
  );
}

export function useCanvasViewSettings(): CanvasViewSettingsContextValue {
  return useContext(CanvasViewSettingsContext);
}

// ─── Resolver helpers — central place to map enum steps to numbers ──
// Consumers should always go through these so future tweaks of the
// numeric values only happen here.

export function resolveEdgeStrokeWidth(step: SizeStep): number {
  switch (step) {
    case 'sm':
      return 1.5;
    case 'lg':
      return 2.75;
    case 'md':
    default:
      return 2;
  }
}

export function resolveArrowSize(step: SizeStep): number {
  switch (step) {
    case 'sm':
      return 7;
    case 'lg':
      return 14;
    case 'md':
    default:
      return 10;
  }
}

export function resolveLabelFontPx(step: SizeStep): number {
  switch (step) {
    case 'sm':
      return 10;
    case 'lg':
      return 13;
    case 'md':
    default:
      return 11;
  }
}

export function resolveSelfLoopBox(step: SizeStep): { w: number; h: number } {
  switch (step) {
    case 'sm':
      return { w: 70, h: 45 };
    case 'lg':
      return { w: 120, h: 75 };
    case 'md':
    default:
      return { w: 90, h: 55 };
  }
}

export function resolveIconStampSize(step: SizeStep): number {
  // Returns the tailwind `size-N` numeric (so `8` → `size-8` = 32px).
  switch (step) {
    case 'sm':
      return 8;
    case 'lg':
      return 12;
    case 'md':
    default:
      return 10;
  }
}

export function resolveBackgroundGap(density: DensityStep): number {
  switch (density) {
    case 'sparse':
      return 32;
    case 'dense':
      return 12;
    case 'normal':
    default:
      return 20;
  }
}
