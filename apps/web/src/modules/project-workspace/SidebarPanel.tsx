import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { createLogger } from '@shared/lib/logger/CreateLogger';

import { useProjectStore } from '@modules/project-management/ProjectStore';
import { useEditorStore } from '@modules/code-editor/EditorStore';
import {
  FileTree,
  type FileTreeNode,
} from '@modules/project-workspace/FileTree';

import { resolveFileRoute } from './FileRouter';
import {
  createDirectory,
  deleteFile,
  renameFile,
  writeFile,
} from './WorkspaceApi';

const logger = createLogger('ProjectWorkspaceSidebarPanel');

export function ProjectWorkspaceSidebarPanel() {
  const { activeProject, fileTree, refreshFileTree, vnextConfig } = useProjectStore();
  const { openTab } = useEditorStore();
  const navigate = useNavigate();

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

  const handleCreateFile = useCallback(
    async (parentPath: string, name: string) => {
      const path = `${parentPath}/${name}`;
      const response = await writeFile(path, '');
      if (!response.success) {
        logger.error('Create file failed', { path });
        return;
      }
      refreshFileTree();
    },
    [refreshFileTree],
  );

  const handleCreateFolder = useCallback(
    async (parentPath: string, name: string) => {
      const path = `${parentPath}/${name}`;
      const response = await createDirectory(path);
      if (!response.success) {
        logger.error('Create folder failed', { path });
        return;
      }
      refreshFileTree();
    },
    [refreshFileTree],
  );

  const handleDeleteFile = useCallback(
    async (path: string) => {
      const response = await deleteFile(path);
      if (!response.success) {
        logger.error('Delete failed', { path });
        return;
      }
      refreshFileTree();
    },
    [refreshFileTree],
  );

  const handleRenameFile = useCallback(
    async (oldPath: string, newName: string) => {
      const dir = oldPath.replace(/\/[^/]+$/, '');
      const newPath = `${dir}/${newName}`;
      const response = await renameFile(oldPath, newPath);
      if (!response.success) {
        logger.error('Rename failed', { oldPath, newPath });
        return;
      }
      refreshFileTree();
    },
    [refreshFileTree],
  );

  const handleCreateWorkflow = useCallback(
    async (parentPath: string, name: string) => {
      if (!activeProject || !vnextConfig) {
        logger.error('No active project or vnextConfig');
        return;
      }

      const componentsRoot = vnextConfig.paths.componentsRoot;
      const workflowsRelDir = vnextConfig.paths.workflows;
      const workflowsFullPath = `${activeProject.path}/${componentsRoot}/${workflowsRelDir}`;
      const workflowName = name.replace(/\.json$/, '').trim();

      if (!workflowName) {
        logger.error('Empty workflow name');
        return;
      }

      const isWorkflowsRoot =
        parentPath === workflowsFullPath || parentPath.endsWith(`/${workflowsRelDir}`);
      const groupPath = isWorkflowsRoot ? `${parentPath}/${workflowName}` : parentPath;
      const groupName = groupPath.split('/').pop() || workflowName;

      logger.info('Creating workflow', {
        groupName,
        groupPath,
        isWorkflowsRoot,
        parentPath,
        workflowName,
      });

      const mkdirResponse = await createDirectory(groupPath);
      if (!mkdirResponse.success) {
        logger.error('mkdir group failed', { path: groupPath });
      }

      const metaResponse = await createDirectory(`${groupPath}/.meta`);
      if (!metaResponse.success) {
        logger.error('mkdir .meta failed', { path: `${groupPath}/.meta` });
      }

      const workflowTemplate = {
        $type: 'workflow',
        key: workflowName,
        domain: vnextConfig.domain || activeProject.domain,
        version: '1.0.0',
        flow: 'sys-flows',
        tags: [],
        attributes: {
          type: 'F',
          labels: [{ label: workflowName, language: 'en' }],
          startTransition: {
            key: 'start',
            target: '',
            versionStrategy: 'Minor',
            labels: [{ label: 'Start', language: 'en' }],
          },
          states: [],
          functions: [],
          features: [],
          extensions: [],
        },
      };

      const workflowResponse = await writeFile(
        `${groupPath}/${workflowName}.json`,
        JSON.stringify(workflowTemplate, null, 2),
      );
      if (!workflowResponse.success) {
        logger.error('Write workflow JSON failed', { path: `${groupPath}/${workflowName}.json` });
        return;
      }

      const diagramResponse = await writeFile(
        `${groupPath}/.meta/${workflowName}.diagram.json`,
        JSON.stringify({ nodePos: {} }, null, 2),
      );
      if (!diagramResponse.success) {
        logger.error('Write diagram JSON failed', {
          path: `${groupPath}/.meta/${workflowName}.diagram.json`,
        });
      }

      await refreshFileTree();
      navigate(`/project/${activeProject.id}/flow/${groupName}/${workflowName}`);
    },
    [activeProject, navigate, refreshFileTree, vnextConfig],
  );

  if (!activeProject) {
    return (
      <div className="text-muted-foreground mt-12 px-4 text-center text-xs">
        No project selected.
        <br />
        <span className="text-subtle text-[10px]">Open a project from the home page.</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mt-2 flex items-center gap-2.5 px-4 pb-3">
        <div className="from-brand-from to-brand-to shadow-brand-glow/20 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-[11px] font-bold text-white shadow-sm">
          {activeProject.domain[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-[13px] font-semibold">
            {activeProject.domain}
          </span>
        </div>
        {activeProject.linked && (
          <Badge variant="secondary" noBorder={false}>
            linked
          </Badge>
        )}
      </div>
      <div className="mt-1">
        {fileTree ? (
          <FileTree
            node={fileTree}
            depth={0}
            onFileClick={handleFileClick}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onCreateWorkflow={handleCreateWorkflow}
            workflowsDir={vnextConfig?.paths?.workflows?.split('/').pop() || 'Workflows'}
          />
        ) : null}
      </div>
    </div>
  );
}
