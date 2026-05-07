import { create } from 'zustand';

import type { ProjectInfo, VnextWorkspaceConfig } from '../shared/projectTypes';

/**
 * Shared "currently-open project" slice consumed by editor views in
 * `@vnext-forge-studio/designer-ui`. Both host shells populate this slice:
 *
 * - Web SPA: `useProjectWorkspacePage` hook (in `apps/web`) calls
 *   `setActiveProject` / `setVnextConfig` after loading the workspace.
 * - VS Code extension webview: `HostEditorBridge` calls `setActiveProject` /
 *   `setVnextConfig` from the init message sent by the extension host.
 *
 * Shell-specific UI state (project list, file tree, template seed dialogs,
 * missing-config bars, Monaco tabs, file-type lookup) lives in the owning
 * shell — see `apps/web/src/app/store/*` for the web-only stores. The
 * VS Code extension webview does not need any of those because VS Code
 * provides its own Explorer / status bar / editor chrome.
 */
interface ProjectState {
  activeProject: ProjectInfo | null;
  vnextConfig: VnextWorkspaceConfig | null;
  loading: boolean;
  error: string | null;
  setActiveProject: (project: ProjectInfo | null) => void;
  setVnextConfig: (config: VnextWorkspaceConfig | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  vnextConfig: null,
  loading: false,
  error: null,

  setActiveProject: (activeProject) => set({ activeProject }),
  setVnextConfig: (vnextConfig) => set({ vnextConfig }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
