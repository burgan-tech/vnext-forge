import { create } from 'zustand';

import {
  getProjectTree,
  useProjectStore,
  type FileTreeNode,
  type ProjectInfo,
} from '@vnext-forge/designer-ui';

import { refreshWorkspaceLayoutAndValidateScript } from '../../modules/project-workspace/syncVnextWorkspaceFromDisk';

/**
 * Web-only project list + file tree state. The web shell lists the user's
 * registered projects on the landing page and renders a custom FileTree in
 * the sidebar; both are web-specific because the VS Code extension uses its
 * own Explorer view to pick which file to open.
 *
 * The currently-open project + its `vnext.config.json` live in the shared
 * `useProjectStore` so editor views (shared across both hosts) can read
 * them without depending on any host-specific state.
 */
interface ProjectListState {
  projects: ProjectInfo[];
  fileTree: FileTreeNode | null;
  /** `fileTree` hangi proje için üretildiyse; `activeProject.id` ile eşleşmezse sidebar eski ağacı göstermez. */
  fileTreeProjectId: string | null;
  setProjects: (projects: ProjectInfo[]) => void;
  setWorkspaceFileTree: (projectId: string | null, tree: FileTreeNode | null) => void;
  refreshFileTree: () => Promise<void>;
}

export const useProjectListStore = create<ProjectListState>((set) => ({
  projects: [],
  fileTree: null,
  fileTreeProjectId: null,
  setProjects: (projects) => set({ projects }),
  setWorkspaceFileTree: (projectId, tree) => set({ fileTree: tree, fileTreeProjectId: projectId }),
  refreshFileTree: async () => {
    const { activeProject, vnextConfig } = useProjectStore.getState();

    if (!activeProject) {
      return;
    }

    try {
      const treeResponse = await getProjectTree(activeProject.id);

      if (!treeResponse.success) {
        throw new Error(treeResponse.error.message);
      }

      set({ fileTree: treeResponse.data, fileTreeProjectId: activeProject.id });

      if (vnextConfig) {
        await refreshWorkspaceLayoutAndValidateScript(activeProject.id);
      }
    } catch {
      set({ fileTree: null, fileTreeProjectId: null });
    }
  },
}));
