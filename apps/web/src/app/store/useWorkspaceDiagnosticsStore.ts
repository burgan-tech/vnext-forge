import { create } from 'zustand';

import type { ValidationIssue } from '@modules/workflow-validation/WorkflowValidationTypes';

interface WorkspaceDiagnosticsState {
  configIssues: ValidationIssue[];
  setConfigIssues: (issues: ValidationIssue[]) => void;
  clearConfigIssues: () => void;
}

export const useWorkspaceDiagnosticsStore = create<WorkspaceDiagnosticsState>((set) => ({
  configIssues: [],
  setConfigIssues: (configIssues) => set({ configIssues }),
  clearConfigIssues: () => set({ configIssues: [] }),
}));
