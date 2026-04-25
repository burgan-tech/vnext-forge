import { create } from 'zustand';
import type { ValidationIssue } from '../modules/workflow-validation/WorkflowValidationTypes';

interface ValidationState {
  issues: ValidationIssue[];
  setIssues: (issues: ValidationIssue[]) => void;
  clearIssues: () => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
  issues: [],
  setIssues: (issues) => set({ issues }),
  clearIssues: () => set({ issues: [] }),
}));
