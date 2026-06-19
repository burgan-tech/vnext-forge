import { createContext, useContext, type ReactNode } from 'react';

export type CanvasMode = 'designer' | 'workflow-view' | 'instance-view';

export interface CanvasTraversedTransition {
  transitionId: string;
  fromState: string;
  toState: string;
}

export interface ExecutionOverlay {
  traversedTransitions: CanvasTraversedTransition[];
  currentState: string | null;
}

export interface CanvasModeContextValue {
  mode: CanvasMode;
  isEditable: boolean;
  executionOverlay: ExecutionOverlay | null;
}

const defaultValue: CanvasModeContextValue = {
  mode: 'designer',
  isEditable: true,
  executionOverlay: null,
};

const CanvasModeContext = createContext<CanvasModeContextValue>(defaultValue);

interface CanvasModeProviderProps {
  mode: CanvasMode;
  executionOverlay?: ExecutionOverlay;
  children: ReactNode;
}

export function CanvasModeProvider({ mode, executionOverlay, children }: CanvasModeProviderProps) {
  return (
    <CanvasModeContext.Provider value={{ mode, isEditable: mode === 'designer', executionOverlay: executionOverlay ?? null }}>
      {children}
    </CanvasModeContext.Provider>
  );
}

export function useCanvasMode(): CanvasModeContextValue {
  return useContext(CanvasModeContext);
}
