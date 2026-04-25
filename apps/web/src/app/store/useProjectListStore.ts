import { create } from 'zustand';

import {
  getProjectTree,
  subscribeWorkspaceFsChange,
  useProjectStore,
  type FileTreeNode,
  type ProjectInfo,
} from '@vnext-forge/designer-ui';

import {
  loadComponentFileTypes,
  refreshWorkspaceLayoutAndValidateScript,
} from '../../modules/project-workspace/syncVnextWorkspaceFromDisk';

let workspaceFsSubscription: (() => void) | null = null;
let workspaceFsRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Tek seferlik: workspace dosya mutasyonlarında sidebar ağacını ve (bayrak açıksa)
 * component file types önbelleğini debounced yeniler.
 */
export function startWorkspaceFsTreeSync(): void {
  if (workspaceFsSubscription) return;
  workspaceFsSubscription = subscribeWorkspaceFsChange(() => {
    if (workspaceFsRefreshTimer) clearTimeout(workspaceFsRefreshTimer);
    workspaceFsRefreshTimer = setTimeout(() => {
      const { activeProject } = useProjectStore.getState();
      if (!activeProject) return;
      void useProjectListStore.getState().refreshFileTree();
      void loadComponentFileTypes(activeProject.id);
    }, 150);
  });
}

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
  /** `refreshFileTree` veya ağaç eşleşmediğinde; kullanıcıya hata + yeniden dene. */
  fileTreeError: string | null;
  isRefreshingFileTree: boolean;
  setProjects: (projects: ProjectInfo[]) => void;
  setWorkspaceFileTree: (projectId: string | null, tree: FileTreeNode | null) => void;
  refreshFileTree: () => Promise<void>;
}

function fileListMessage(err: unknown): string {
  if (err instanceof Error && err.message.length > 0) {
    return err.message;
  }
  return 'Could not load file list';
}

export const useProjectListStore = create<ProjectListState>((set) => ({
  projects: [],
  fileTree: null,
  fileTreeProjectId: null,
  fileTreeError: null,
  isRefreshingFileTree: false,
  setProjects: (projects) => set({ projects }),
  setWorkspaceFileTree: (projectId, tree) =>
    set({ fileTree: tree, fileTreeProjectId: projectId, fileTreeError: null }),
  refreshFileTree: async () => {
    const { activeProject, vnextConfig } = useProjectStore.getState();

    if (!activeProject) {
      return;
    }

    set({ isRefreshingFileTree: true, fileTreeError: null });

    try {
      const treeResponse = await getProjectTree(activeProject.id);

      if (!treeResponse.success) {
        throw new Error(treeResponse.error.message);
      }

      set({
        fileTree: treeResponse.data,
        fileTreeProjectId: activeProject.id,
        fileTreeError: null,
      });

      if (vnextConfig) {
        try {
          await refreshWorkspaceLayoutAndValidateScript(activeProject.id);
        } catch {
          /* Ağaç geçerli; layout/validate türetimi ayrı hata, ağacı silme. */
        }
      }
    } catch (err) {
      set({
        fileTree: null,
        fileTreeProjectId: null,
        fileTreeError: fileListMessage(err),
      });
    } finally {
      set({ isRefreshingFileTree: false });
    }
  },
}));
