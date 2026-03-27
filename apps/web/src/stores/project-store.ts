import { create } from 'zustand';

export interface ProjectInfo {
  id: string;
  domain: string;
  description?: string;
  path: string;
  version?: string;
  linked?: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface VnextConfig {
  version: string;
  description?: string;
  domain: string;
  runtimeVersion?: string;
  schemaVersion?: string;
  paths: {
    componentsRoot: string;
    tasks: string;
    views: string;
    functions: string;
    extensions: string;
    workflows: string;
    schemas: string;
    mappings: string;
  };
  exports?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  referenceResolution?: Record<string, unknown>;
}

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
    if (!activeProject) return;
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/tree`);
      if (res.ok) {
        const tree = await res.json();
        set({ fileTree: tree });
      }
    } catch {
      // silently fail
    }
  },
}));
