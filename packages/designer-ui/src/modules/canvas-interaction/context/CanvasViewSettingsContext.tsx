import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';

export type LayoutAlgorithm = 'dagre' | 'elk';
export type LayoutDirection = 'DOWN' | 'RIGHT';
export type EdgePathStyle = 'smoothstep' | 'bezier' | 'straight';

export interface CanvasViewSettings {
  algorithm: LayoutAlgorithm;
  direction: LayoutDirection;
  edgePathStyle: EdgePathStyle;
}

interface CanvasViewSettingsContextValue {
  settings: CanvasViewSettings;
  updateSettings: (patch: Partial<CanvasViewSettings>) => void;
}

const defaultSettings: CanvasViewSettings = {
  algorithm: 'dagre',
  direction: 'DOWN',
  edgePathStyle: 'smoothstep',
};

const CanvasViewSettingsContext = createContext<CanvasViewSettingsContextValue>({
  settings: defaultSettings,
  updateSettings: () => {},
});

export function CanvasViewSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CanvasViewSettings>(defaultSettings);

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
