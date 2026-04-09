import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/badge';
import { Input } from '@shared/ui/input';

import { useUIStore } from '@app/store/ui-store';

import { resolveFileRoute } from '../../../lib/file-router';
import { FileTree, type FileTreeNode } from '../../../project/FileTree';
import { useEditorStore } from '../../../stores/editor-store';
import { useProjectStore } from '../../../stores/project-store';

export function Sidebar() {
  const { sidebarView } = useUIStore();
  const { activeProject, fileTree, refreshFileTree, vnextConfig } = useProjectStore();
  const { openTab } = useEditorStore();
  const navigate = useNavigate();

  const handleFileClick = useCallback(
    (node: FileTreeNode) => {
      if (!activeProject) return;
      const route = resolveFileRoute(node.path, vnextConfig, activeProject.id, activeProject.path);

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
      try {
        await fetch('/api/files', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: `${parentPath}/${name}`, content: '' }),
        });
        refreshFileTree();
      } catch (err) {
        console.error('Create file failed:', err);
      }
    },
    [refreshFileTree],
  );

  const handleCreateFolder = useCallback(
    async (parentPath: string, name: string) => {
      try {
        await fetch('/api/files/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: `${parentPath}/${name}` }),
        });
        refreshFileTree();
      } catch (err) {
        console.error('Create folder failed:', err);
      }
    },
    [refreshFileTree],
  );

  const handleDeleteFile = useCallback(
    async (path: string) => {
      try {
        await fetch(`/api/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
        refreshFileTree();
      } catch (err) {
        console.error('Delete failed:', err);
      }
    },
    [refreshFileTree],
  );

  const handleRenameFile = useCallback(
    async (oldPath: string, newName: string) => {
      const dir = oldPath.replace(/\/[^/]+$/, '');
      const newPath = `${dir}/${newName}`;

      try {
        await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath, newPath }),
        });
        refreshFileTree();
      } catch (err) {
        console.error('Rename failed:', err);
      }
    },
    [refreshFileTree],
  );

  const handleCreateWorkflow = useCallback(
    async (parentPath: string, name: string) => {
      if (!activeProject || !vnextConfig) {
        console.error('[CreateWorkflow] No active project or vnextConfig');
        return;
      }

      const componentsRoot = vnextConfig.paths.componentsRoot;
      const workflowsRelDir = vnextConfig.paths.workflows;
      const workflowsFullPath = `${activeProject.path}/${componentsRoot}/${workflowsRelDir}`;

      const wfName = name.replace(/\.json$/, '').trim();
      if (!wfName) {
        console.error('[CreateWorkflow] Empty workflow name');
        return;
      }

      const isWorkflowsRoot =
        parentPath === workflowsFullPath || parentPath.endsWith(`/${workflowsRelDir}`);

      const groupPath = isWorkflowsRoot ? `${parentPath}/${wfName}` : parentPath;
      const groupName = groupPath.split('/').pop() || wfName;

      console.log('[CreateWorkflow]', {
        groupName,
        groupPath,
        isWorkflowsRoot,
        parentPath,
        wfName,
        workflowsFullPath,
      });

      try {
        const mkdirRes = await fetch('/api/files/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: groupPath }),
        });
        if (!mkdirRes.ok) {
          console.error('[CreateWorkflow] mkdir group failed:', await mkdirRes.text());
        }

        const metaRes = await fetch('/api/files/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: `${groupPath}/.meta` }),
        });
        if (!metaRes.ok) {
          console.error('[CreateWorkflow] mkdir .meta failed:', await metaRes.text());
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

        const workflowRes = await fetch('/api/files', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `${groupPath}/${wfName}.json`,
            content: JSON.stringify(workflowTemplate, null, 2),
          }),
        });
        if (!workflowRes.ok) {
          console.error('[CreateWorkflow] write workflow JSON failed:', await workflowRes.text());
          return;
        }

        const diagramTemplate = { nodePos: {} };
        const diagramRes = await fetch('/api/files', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `${groupPath}/.meta/${wfName}.diagram.json`,
            content: JSON.stringify(diagramTemplate, null, 2),
          }),
        });
        if (!diagramRes.ok) {
          console.error('[CreateWorkflow] write diagram JSON failed:', await diagramRes.text());
        }

        console.log(
          '[CreateWorkflow] Success! Navigating to:',
          `/project/${activeProject.id}/flow/${groupName}/${wfName}`,
        );
        await refreshFileTree();
        navigate(`/project/${activeProject.id}/flow/${groupName}/${wfName}`);
      } catch (err) {
        console.error('[CreateWorkflow] Exception:', err);
      }
    },
    [activeProject, navigate, refreshFileTree, vnextConfig],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
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
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-from to-brand-to text-[11px] font-bold text-white shadow-sm shadow-brand-glow/20">
                    {activeProject.domain[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
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
              <div className="mt-12 px-4 text-center text-xs text-muted-foreground">
                No project selected.
                <br />
                <span className="text-[10px] text-subtle">
                  Open a project from the home page.
                </span>
              </div>
            )}
          </>
        )}

        {sidebarView === 'search' && (
          <div className="mt-2 px-3">
            <Input size="sm" placeholder="Search files..." />
            <div className="mt-6 text-center text-[10px] text-muted-foreground">
              Type to search across project files
            </div>
          </div>
        )}

        {sidebarView === 'validation' && (
          <div className="mt-12 px-4 text-center text-xs text-muted-foreground">No problems detected</div>
        )}

        {sidebarView === 'templates' && (
          <div className="mt-12 px-4 text-center text-xs text-muted-foreground">Settings coming soon</div>
        )}
      </div>
    </div>
  );
}
