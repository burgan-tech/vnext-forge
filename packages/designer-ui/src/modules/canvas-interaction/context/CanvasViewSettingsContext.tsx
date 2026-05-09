import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';
import { useSettingsStore, type ColorThemePreference } from '../../../store/useSettingsStore.js';

export type LayoutAlgorithm = 'dagre' | 'elk';
export type LayoutDirection = 'DOWN' | 'RIGHT';
export type EdgePathStyle = 'smoothstep' | 'bezier' | 'straight';

export interface CanvasViewSettings {
  algorithm: LayoutAlgorithm;
  direction: LayoutDirection;
  edgePathStyle: EdgePathStyle;
  showWorkflowEdges: boolean;
}

interface CanvasViewSettingsContextValue {
  settings: CanvasViewSettings;
  updateSettings: (patch: Partial<CanvasViewSettings>) => void;
}

const VALID_ALGORITHMS: readonly string[] = ['dagre', 'elk'];
const VALID_DIRECTIONS: readonly string[] = ['DOWN', 'RIGHT'];
const VALID_EDGE_STYLES: readonly string[] = ['smoothstep', 'bezier', 'straight'];
const VALID_THEMES: readonly string[] = ['dark', 'light', 'system'];

const defaultSettings: CanvasViewSettings = {
  algorithm: 'dagre',
  direction: 'DOWN',
  edgePathStyle: 'smoothstep',
  showWorkflowEdges: true,
};

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

function readInitialSettings(): CanvasViewSettings {
  try {
    const config = (window as unknown as Record<string, unknown>).__VNEXT_CONFIG__ as
      | Record<string, unknown>
      | undefined;
    if (!config) return defaultSettings;

    if (config.themeMode) {
      applyThemeModeIfValid(config.themeMode);
    }

    applyAutoSaveIfPresent(config.autoSaveEnabled);

    if (!config.canvasViewSettings) return defaultSettings;

    const host = config.canvasViewSettings as Record<string, unknown>;
    return {
      algorithm: VALID_ALGORITHMS.includes(host.algorithm as string)
        ? (host.algorithm as LayoutAlgorithm)
        : defaultSettings.algorithm,
      direction: VALID_DIRECTIONS.includes(host.direction as string)
        ? (host.direction as LayoutDirection)
        : defaultSettings.direction,
      edgePathStyle: VALID_EDGE_STYLES.includes(host.edgePathStyle as string)
        ? (host.edgePathStyle as EdgePathStyle)
        : defaultSettings.edgePathStyle,
      showWorkflowEdges: typeof host.showWorkflowEdges === 'boolean'
        ? host.showWorkflowEdges
        : defaultSettings.showWorkflowEdges,
    };
  } catch {
    return defaultSettings;
  }
}

const CanvasViewSettingsContext = createContext<CanvasViewSettingsContextValue>({
  settings: defaultSettings,
  updateSettings: () => {},
});

export function CanvasViewSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CanvasViewSettings>(readInitialSettings);

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

      setSettings((prev) => ({
        algorithm: VALID_ALGORITHMS.includes(incoming.algorithm as string)
          ? (incoming.algorithm as LayoutAlgorithm)
          : prev.algorithm,
        direction: VALID_DIRECTIONS.includes(incoming.direction as string)
          ? (incoming.direction as LayoutDirection)
          : prev.direction,
        edgePathStyle: VALID_EDGE_STYLES.includes(incoming.edgePathStyle as string)
          ? (incoming.edgePathStyle as EdgePathStyle)
          : prev.edgePathStyle,
        showWorkflowEdges: typeof incoming.showWorkflowEdges === 'boolean'
          ? incoming.showWorkflowEdges
          : prev.showWorkflowEdges,
      }));
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const value = useMemo<CanvasViewSettingsContextValue>(
    () => ({
      settings,
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
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
