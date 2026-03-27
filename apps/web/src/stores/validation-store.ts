import { create } from 'zustand';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  message: string;
  path?: string;
  nodeId?: string;
  edgeId?: string;
  rule: string;
}

interface ValidationState {
  issues: ValidationIssue[];
  isValidating: boolean;

  setIssues: (issues: ValidationIssue[]) => void;
  clearIssues: () => void;
  setValidating: (v: boolean) => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
  issues: [],
  isValidating: false,

  setIssues: (issues) => set({ issues }),
  clearIssues: () => set({ issues: [] }),
  setValidating: (isValidating) => set({ isValidating }),
}));
