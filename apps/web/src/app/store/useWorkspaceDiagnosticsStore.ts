import { create } from 'zustand';

import type { ValidationIssue } from '@vnext-forge/designer-ui';

/**
 * Web-only status-bar diagnostics for the currently open workspace. Surfaces
 * vnext.config.json validation issues in the chrome popover; the extension
 * webview does not render these because VS Code reports them via the
 * Problems panel / output channels instead.
 */
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
