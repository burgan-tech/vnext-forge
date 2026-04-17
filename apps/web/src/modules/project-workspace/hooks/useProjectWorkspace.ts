import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { failureFromCode, ERROR_CODES, getData } from '@vnext-forge/app-contracts';

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
  const { openTab } = useEditorStore();
  const navigate = useNavigate();

  const refreshWorkspaceTree = useCallback(async () => {
    await refreshFileTree();
    if (activeProject) {
      void loadComponentFileTypes(activeProject.id);
    }
  }, [refreshFileTree, activeProject]);

  const notifyInvalidName = useCallback((message: string) => {
    showNotification({
      message,
      type: 'error',
    });
  }, []);

  const notifyOperationError = useCallback((message: string) => {
    showNotification({
      message,
      type: 'error',
    });
  }, []);

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

  const { execute: handleCreateFile } = useAsync(
    async (parentPath: string, name: string) => {
      const validationError = getWorkspaceNameError(name, 'file');
      if (validationError) {
        notifyInvalidName(validationError);
        return failureFromCode(ERROR_CODES.FILE_INVALID_PATH, validationError);
      }

      return writeFile(`${parentPath}/${normalizeWorkspaceName(name, 'file')}`, '');
    },
    {
      onSuccess: refreshWorkspaceTree,
      onError: () => notifyOperationError('File could not be created.'),
      showNotificationOnError: false,
    },
  );

  const { execute: handleCreateFolder } = useAsync(
    async (parentPath: string, name: string) => {
      const validationError = getWorkspaceNameError(name, 'folder');
      if (validationError) {
        notifyInvalidName(validationError);
        return failureFromCode(ERROR_CODES.FILE_INVALID_PATH, validationError);
      }

      return createDirectory(`${parentPath}/${normalizeWorkspaceName(name, 'folder')}`);
    },
    {
      onSuccess: refreshWorkspaceTree,
      onError: () => notifyOperationError('Folder could not be created.'),
      showNotificationOnError: false,
    },
  );

  const { execute: handleDeleteFile } = useAsync((path: string) => deleteFile(path), {
    onSuccess: refreshWorkspaceTree,
    onError: () => notifyOperationError('Item could not be deleted.'),
    showNotificationOnError: false,
  });

  const { execute: handleRenameFile } = useAsync(
    (oldPath: string, newName: string) => {
      const validationError = getWorkspaceNameError(newName, 'rename');
      if (validationError) {
        notifyInvalidName(validationError);
        return Promise.resolve(failureFromCode(ERROR_CODES.FILE_INVALID_PATH, validationError));
      }

      const dir = oldPath.replace(/\/[^/]+$/, '');
      return renameFile(oldPath, `${dir}/${normalizeWorkspaceName(newName, 'rename')}`);
    },
    {
      onSuccess: refreshWorkspaceTree,
      onError: () => notifyOperationError('Item could not be renamed.'),
      showNotificationOnError: false,
    },
  );

  const { execute: handleCreateWorkflow } = useAsync(
    (parentPath: string, name: string) => {
      const validationError = getWorkspaceNameError(name, 'workflow');
      if (validationError) {
        notifyInvalidName(validationError);
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
      onError: () => notifyOperationError('Workflow scaffold could not be created.'),
      showNotificationOnError: false,
    },
  );

  return {
    activeProject,
    fileTree,
    vnextConfig,
    handleFileClick,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteFile,
    handleRenameFile,
    handleCreateWorkflow,
  };
}
