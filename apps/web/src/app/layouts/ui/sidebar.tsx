import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/badge';
import { Input } from '@shared/ui/input';

import { useUIStore } from '@app/store/ui-store';

import { useProjectStore } from '@entities/project/model/project-store';
import { resolveFileRoute } from '@entities/project/lib/file-router';
import { FileTree } from '@widgets/file-tree/ui/file-tree';
import type { FileTreeNode } from '@widgets/file-tree/ui/file-tree';
import { useEditorStore } from '../../../stores/editor-store';
import {
  createDirectory,
  deleteFile,
  renameFile,
  writeFile,
} from '@entities/workspace/api/workspace-api';
import { createLogger } from '@shared/lib/logger/createLogger';

const logger = createLogger('Sidebar');

export function Sidebar() {
  const { sidebarView } = useUIStore();
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
      } else if (route.editorTab) {
        openTab({
          id: route.editorTab.filePath,
          title: route.editorTab.title,
          filePath: route.editorTab.filePath,
          language: route.editorTab.language,
        });
        navigate(
          `/project/${activeProject.id}/code/${encodeURIComponent(route.editorTab.filePath)}`,
        );
      }
    },
    [activeProject, navigate, openTab, vnextConfig],
  );

  const handleCreateFile = useCallback(
    async (parentPath: string, name: string) => {
      const res = await writeFile(`${parentPath}/${name}`, '');
      if (!res.success) {
        logger.error('Create file failed', { path: `${parentPath}/${name}` });
        return;
      }
      refreshFileTree();
    },
    [refreshFileTree],
  );

  const handleCreateFolder = useCallback(
    async (parentPath: string, name: string) => {
      const res = await createDirectory(`${parentPath}/${name}`);
      if (!res.success) {
        logger.error('Create folder failed', { path: `${parentPath}/${name}` });
        return;
      }
      refreshFileTree();
    },
    [refreshFileTree],
  );

  const handleDeleteFile = useCallback(
    async (path: string) => {
      const res = await deleteFile(path);
      if (!res.success) {
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
      const res = await renameFile(oldPath, newPath);
      if (!res.success) {
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

      const wfName = name.replace(/\.json$/, '').trim();
      if (!wfName) {
        logger.error('Empty workflow name');
        return;
      }

      const isWorkflowsRoot =
        parentPath === workflowsFullPath || parentPath.endsWith(`/${workflowsRelDir}`);

      const groupPath = isWorkflowsRoot ? `${parentPath}/${wfName}` : parentPath;
      const groupName = groupPath.split('/').pop() || wfName;

      logger.info('Creating workflow', {
        groupName,
        groupPath,
        isWorkflowsRoot,
        parentPath,
        wfName,
      });

      const mkdirRes = await createDirectory(groupPath);
      if (!mkdirRes.success) {
        logger.error('mkdir group failed', { path: groupPath });
      }

      const metaRes = await createDirectory(`${groupPath}/.meta`);
      if (!metaRes.success) {
        logger.error('mkdir .meta failed', { path: `${groupPath}/.meta` });
      }

      const workflowTemplate = {
        $type: 'workflow',
        key: wfName,
        domain: vnextConfig.domain || activeProject.domain,
        version: '1.0.0',
        flow: 'sys-flows',
        tags: [],
        attributes: {
          type: 'F',
          labels: [{ label: wfName, language: 'en' }],
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

      const workflowRes = await writeFile(
        `${groupPath}/${wfName}.json`,
        JSON.stringify(workflowTemplate, null, 2),
      );
      if (!workflowRes.success) {
        logger.error(`Write workflow JSON failed: ${groupPath}/${wfName}.json`);
        return;
      }

      const diagramRes = await writeFile(
        `${groupPath}/.meta/${wfName}.diagram.json`,
        JSON.stringify({ nodePos: {} }, null, 2),
      );
      if (!diagramRes.success) {
        logger.error(`Write diagram JSON failed: ${groupPath}/.meta/${wfName}.diagram.json`);
      }

      logger.info(
        `Workflow created, navigating to /project/${activeProject.id}/flow/${groupName}/${wfName}`,
      );
      await refreshFileTree();
      navigate(`/project/${activeProject.id}/flow/${groupName}/${wfName}`);
    },
    [activeProject, navigate, refreshFileTree, vnextConfig],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="text-muted-foreground px-4 py-3 text-[11px] font-semibold tracking-widest uppercase">
        {sidebarView === 'project' && 'Explorer'}
        {sidebarView === 'search' && 'Search'}
        {sidebarView === 'validation' && 'Problems'}
        {sidebarView === 'templates' && 'Settings'}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sidebarView === 'project' && (
          <>
            {activeProject ? (
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
                  {fileTree && (
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
                  )}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground mt-12 px-4 text-center text-xs">
                No project selected.
                <br />
                <span className="text-subtle text-[10px]">Open a project from the home page.</span>
              </div>
            )}
          </>
        )}

        {sidebarView === 'search' && (
          <div className="mt-2 px-3">
            <Input size="sm" placeholder="Search files..." />
            <div className="text-muted-foreground mt-6 text-center text-[10px]">
              Type to search across project files
            </div>
          </div>
        )}

        {sidebarView === 'validation' && (
          <div className="text-muted-foreground mt-12 px-4 text-center text-xs">
            No problems detected
          </div>
        )}

        {sidebarView === 'templates' && (
          <div className="text-muted-foreground mt-12 px-4 text-center text-xs">
            Settings coming soon
          </div>
        )}
      </div>
    </div>
  );
}
