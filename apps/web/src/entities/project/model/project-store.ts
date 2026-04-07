import { create } from 'zustand';

import { apiClient, unwrapApi } from '@shared/api/client';

import type { FileTreeNode, ProjectInfo, VnextConfig } from './types';

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
      const tree = await unwrapApi<FileTreeNode>(
        await apiClient.api.projects[':id'].tree.$get({
          param: { id: activeProject.id },
        }),
        'Project tree could not be loaded.',
      );

      set({ fileTree: tree });
    } catch {
      set({ fileTree: null });
    }
  },
}));
