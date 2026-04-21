import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  failureFromCode,
  ERROR_CODES,
  getData,
  type VnextForgeError,
} from '@vnext-forge/app-contracts';

import {
  createDirectory,
  createLogger,
  deleteFile,
  getWorkspaceNameError,
  normalizeWorkspaceName,
  renameFile,
  scaffoldWorkflow,
  showNotification,
  useAsync,
  useEditorStore,
  useProjectStore,
  writeFile,
  type FileTreeNode,
} from '@vnext-forge/designer-ui';

import { useProjectListStore } from '../../../app/store/useProjectListStore';
import { resolveFileRoute } from '../FileRouter';
import { loadComponentFileTypes } from '../syncVnextWorkspaceFromDisk';

const logger = createLogger('useProjectWorkspace');

export function useProjectWorkspace() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const fileTree = useProjectListStore((s) => s.fileTree);
  const refreshFileTree = useProjectListStore((s) => s.refreshFileTree);
  const openTab = useEditorStore((s) => s.openTab);
  const navigate = useNavigate();

  const refreshWorkspaceTree = useCallback(async () => {
    await refreshFileTree();
    if (activeProject) {
      void loadComponentFileTypes(activeProject.id);
    }
  }, [refreshFileTree, activeProject]);

  /**
   * Single toast owner for workspace tree mutations: `useAsync` treats
   * validation failures (`failureFromCode`) like transport errors, so we must
   * not fire a separate inline validation toast (R-f16 double-notify).
   */
  const reportWorkspaceMutationError = useCallback(
    (fallbackMessage: string) => (err: VnextForgeError) => {
      const message =
        err.code === ERROR_CODES.FILE_INVALID_PATH
          ? err.toUserMessage().message
          : fallbackMessage;
      const kind = err.code === ERROR_CODES.FILE_INVALID_PATH ? 'warning' : 'error';
      showNotification({ message, kind });
    },
    [],
  );

  const handleFileClick = useCallback(
    (node: FileTreeNode) => {
      if (!activeProject) return;
      const route = resolveFileRoute(node.path, vnextConfig, activeProject.id, activeProject.path);
      logger.info('File clicked', { path: node.path, resolvedRoute: route });
      if (route.navigateTo) {
        navigate(route.navigateTo);
        return;
      }
      if (!route.editorTab) return;
      openTab({
        id: route.editorTab.filePath,
        title: route.editorTab.title,
        filePath: route.editorTab.filePath,
        language: route.editorTab.language,
      });
      navigate(`/project/${activeProject.id}/code/${encodeURIComponent(route.editorTab.filePath)}`);
    },
    [activeProject, navigate, openTab, vnextConfig],
  );

  /** Opens JSON in the Monaco tab, bypassing designer routes (workflow/task/schema/…). */
  const handleOpenFileInCodeEditor = useCallback(
    (node: FileTreeNode) => {
      if (!activeProject || node.type !== 'file') return;
      const normalizedFilePath = node.path.replace(/\\/g, '/');
      openTab({
        id: normalizedFilePath,
        title: node.name,
        filePath: normalizedFilePath,
        language: 'json',
      });
      navigate(`/project/${activeProject.id}/code/${encodeURIComponent(normalizedFilePath)}`);
    },
    [activeProject, navigate, openTab],
  );

  const { execute: handleCreateFile } = useAsync(
    async (parentPath: string, name: string) => {
      const validationError = getWorkspaceNameError(name, 'file');
      if (validationError) {
        return failureFromCode(ERROR_CODES.FILE_INVALID_PATH, validationError);
      }

      return writeFile(`${parentPath}/${normalizeWorkspaceName(name, 'file')}`, '');
    },
    {
      onSuccess: refreshWorkspaceTree,
      onError: reportWorkspaceMutationError('File could not be created.'),
      showNotificationOnError: false,
    },
  );

  const { execute: handleCreateFolder } = useAsync(
    async (parentPath: string, name: string) => {
      const validationError = getWorkspaceNameError(name, 'folder');
      if (validationError) {
        return failureFromCode(ERROR_CODES.FILE_INVALID_PATH, validationError);
      }

      return createDirectory(`${parentPath}/${normalizeWorkspaceName(name, 'folder')}`);
    },
    {
      onSuccess: refreshWorkspaceTree,
      onError: reportWorkspaceMutationError('Folder could not be created.'),
      showNotificationOnError: false,
    },
  );

  const { execute: handleDeleteFile } = useAsync((path: string) => deleteFile(path), {
    onSuccess: refreshWorkspaceTree,
    onError: reportWorkspaceMutationError('Item could not be deleted.'),
    showNotificationOnError: false,
  });

  const { execute: handleRenameFile } = useAsync(
    (oldPath: string, newName: string) => {
      const validationError = getWorkspaceNameError(newName, 'rename');
      if (validationError) {
        return Promise.resolve(failureFromCode(ERROR_CODES.FILE_INVALID_PATH, validationError));
      }

      const dir = oldPath.replace(/\/[^/]+$/, '');
      return renameFile(oldPath, `${dir}/${normalizeWorkspaceName(newName, 'rename')}`);
    },
    {
      onSuccess: refreshWorkspaceTree,
      onError: reportWorkspaceMutationError('Item could not be renamed.'),
      showNotificationOnError: false,
    },
  );

  const { execute: handleCreateWorkflow } = useAsync(
    (parentPath: string, name: string) => {
      const validationError = getWorkspaceNameError(name, 'workflow');
      if (validationError) {
        return Promise.resolve(failureFromCode(ERROR_CODES.FILE_INVALID_PATH, validationError));
      }

      if (!activeProject || !vnextConfig) {
        return Promise.resolve(
          failureFromCode(ERROR_CODES.PROJECT_INVALID_CONFIG, 'No active project or config loaded'),
        );
      }
      return scaffoldWorkflow({
        parentPath,
        name: normalizeWorkspaceName(name, 'workflow'),
        projectPath: activeProject.path,
        componentsRoot: vnextConfig.paths.componentsRoot,
        workflowsRelDir: vnextConfig.paths.workflows,
        domain: vnextConfig.domain || activeProject.domain,
      });
    },
    {
      onSuccess: async (result) => {
        const data = getData(result);
        await refreshWorkspaceTree();
        if (activeProject && data) {
          navigate(`/project/${activeProject.id}/flow/${data.groupName}/${data.workflowName}`);
        }
      },
      onError: reportWorkspaceMutationError('Workflow scaffold could not be created.'),
      showNotificationOnError: false,
    },
  );

  return {
    activeProject,
    fileTree,
    vnextConfig,
    handleFileClick,
    handleOpenFileInCodeEditor,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteFile,
    handleRenameFile,
    handleCreateWorkflow,
  };
}
