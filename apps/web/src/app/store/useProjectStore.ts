import { create } from 'zustand';

import { getProjectTree } from '@modules/project-management/ProjectApi';

import type {
  FileTreeNode,
  ProjectInfo,
  VnextConfig,
} from '@modules/project-management/ProjectTypes';

interface ProjectState {
  projects: ProjectInfo[];
  activeProject: ProjectInfo | null;
  fileTree: FileTreeNode | null;
  vnextConfig: VnextConfig | null;
  loading: boolean;
  error: string | null;
  setProjects: (projects: ProjectInfo[]) => void;
  setActiveProject: (project: ProjectInfo | null) => void;
  setFileTree: (tree: FileTreeNode | null) => void;
  setVnextConfig: (config: VnextConfig | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshFileTree: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  fileTree: null,
  vnextConfig: null,
  loading: false,
  error: null,

  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => set({ activeProject }),
  setFileTree: (fileTree) => set({ fileTree }),
  setVnextConfig: (vnextConfig) => set({ vnextConfig }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  refreshFileTree: async () => {
    const { activeProject } = get();

    if (!activeProject) {
      return;
    }

    try {
      const treeResponse = await getProjectTree(activeProject.id);

      if (!treeResponse.success) {
        throw new Error(treeResponse.error.message);
      }

      set({ fileTree: treeResponse.data });
    } catch {
      set({ fileTree: null });
    }
  },
}));
