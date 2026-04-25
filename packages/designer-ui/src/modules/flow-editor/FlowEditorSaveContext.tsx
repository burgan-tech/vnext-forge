import { createContext, useContext, type ReactNode } from 'react';

export interface FlowEditorSaveContextValue {
  /** Persists workflow JSON, diagram, and embedded scripts (same as toolbar Save). */
  saveWorkflow: () => Promise<void>;
}

const FlowEditorSaveContext = createContext<FlowEditorSaveContextValue | null>(null);

export function FlowEditorSaveProvider({
  children,
  saveWorkflow,
}: {
  children: ReactNode;
  saveWorkflow: () => Promise<void>;
}) {
  return (
    <FlowEditorSaveContext.Provider value={{ saveWorkflow }}>{children}</FlowEditorSaveContext.Provider>
  );
}

/** `null` when not under {@link FlowEditorSaveProvider} (e.g. storybook). */
export function useFlowEditorSave(): FlowEditorSaveContextValue | null {
  return useContext(FlowEditorSaveContext);
}
