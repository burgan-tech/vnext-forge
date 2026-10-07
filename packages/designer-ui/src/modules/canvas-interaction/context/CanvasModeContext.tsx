import { createContext, useContext, type ReactNode } from 'react';

export type CanvasMode = 'designer' | 'workflow-view' | 'instance-view';

export interface CanvasTraversedTransition {
  transitionId: string;
  fromState: string;
  toState: string;
}

export interface ExecutionOverlay {
  /** Oldest first — the order is the path order shown on edges. */
  traversedTransitions: CanvasTraversedTransition[];
  currentState: string | null;
  /** Fade everything off the path further and show path order on edges. */
  pathOnly?: boolean;
  /** Element selected outside the canvas (e.g. a path timeline chip); pulses like a search hit. */
  focus?: { kind: 'state' | 'transition'; key: string } | null;
  /** States where a task failed or an incident was raised. */
  faultedStates?: string[];
  /** States with an unresolved incident (warning marker). */
  incidentStates?: string[];
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
