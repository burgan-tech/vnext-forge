import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/ui-store';
import { useProjectStore } from '../stores/project-store';
import { useEditorStore } from '../stores/editor-store';
import { FileTree, type FileTreeNode } from '../project/FileTree';
import { resolveFileRoute } from '../lib/file-router';

export function Sidebar() {
  const { sidebarView } = useUIStore();
  const { activeProject, fileTree, vnextConfig, refreshFileTree } = useProjectStore();
  const { openTab } = useEditorStore();
  const navigate = useNavigate();

  const handleFileClick = useCallback(
    (node: FileTreeNode) => {
      if (!activeProject) return;
      const route = resolveFileRoute(
        node.path,
        vnextConfig,
        activeProject.id,
        activeProject.path,
      );

      if (route.navigateTo) {
        navigate(route.navigateTo);
      } else if (route.editorTab) {
        openTab({
          id: route.editorTab.filePath,
          title: route.editorTab.title,
          filePath: route.editorTab.filePath,
          language: route.editorTab.language,
        });
        navigate(`/project/${activeProject.id}/code/${encodeURIComponent(route.editorTab.filePath)}`);
      }
    },
    [activeProject, vnextConfig, navigate, openTab],
  );

  const handleCreateFile = useCallback(async (parentPath: string, name: string) => {
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
  }, [refreshFileTree]);

  const handleCreateFolder = useCallback(async (parentPath: string, name: string) => {
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
  }, [refreshFileTree]);

  const handleDeleteFile = useCallback(async (path: string) => {
    try {
      await fetch(`/api/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
      refreshFileTree();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [refreshFileTree]);

  const handleRenameFile = useCallback(async (oldPath: string, newName: string) => {
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
  }, [refreshFileTree]);

  const handleCreateWorkflow = useCallback(async (parentPath: string, name: string) => {
    if (!activeProject || !vnextConfig) {
      console.error('[CreateWorkflow] No active project or vnextConfig');
      return;
    }

    const componentsRoot = vnextConfig.paths.componentsRoot;
    const workflowsRelDir = vnextConfig.paths.workflows;
    const workflowsFullPath = `${activeProject.path}/${componentsRoot}/${workflowsRelDir}`;

    let wfName = name.replace(/\.json$/, '').trim();
    if (!wfName) {
      console.error('[CreateWorkflow] Empty workflow name');
      return;
    }

    // Determine group folder
    // If parentPath ends with the Workflows dir name, it's the Workflows root
    const isWorkflowsRoot = parentPath === workflowsFullPath ||
      parentPath.endsWith(`/${workflowsRelDir}`);

    let groupPath: string;
    if (isWorkflowsRoot) {
      // Workflows root → use name as both group and workflow name
      groupPath = `${parentPath}/${wfName}`;
    } else {
      // Already inside a group folder
      groupPath = parentPath;
    }

    const groupName = groupPath.split('/').pop() || wfName;

    console.log('[CreateWorkflow]', { parentPath, wfName, groupPath, groupName, workflowsFullPath, isWorkflowsRoot });

    try {
      // 1. Create group folder if not exists
      const mkdirRes = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: groupPath }),
      });
      if (!mkdirRes.ok) {
        console.error('[CreateWorkflow] mkdir group failed:', await mkdirRes.text());
      }

      // 2. Create .meta folder
      const metaRes = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: `${groupPath}/.meta` }),
      });
      if (!metaRes.ok) {
        console.error('[CreateWorkflow] mkdir .meta failed:', await metaRes.text());
      }

      // 3. Create workflow JSON
      const workflowTemplate = {
        "$type": "workflow",
        key: wfName,
        domain: vnextConfig.domain || activeProject.domain,
        version: "1.0.0",
        flow: "sys-flows",
        tags: [],
        attributes: {
          type: "F",
          labels: [{ label: wfName, language: "en" }],
          startTransition: {
            key: "start",
            target: "",
            versionStrategy: "Minor",
            labels: [{ label: "Start", language: "en" }],
          },
          states: [],
          functions: [],
          features: [],
          extensions: [],
        },
      };

      const wfRes = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${groupPath}/${wfName}.json`,
          content: JSON.stringify(workflowTemplate, null, 2),
        }),
      });
      if (!wfRes.ok) {
        console.error('[CreateWorkflow] write workflow JSON failed:', await wfRes.text());
        return;
      }

      // 4. Create diagram JSON
      const diagramTemplate = { nodePos: {} };
      const diagRes = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${groupPath}/.meta/${wfName}.diagram.json`,
          content: JSON.stringify(diagramTemplate, null, 2),
        }),
      });
      if (!diagRes.ok) {
        console.error('[CreateWorkflow] write diagram JSON failed:', await diagRes.text());
      }

      // 5. Refresh and navigate
      console.log('[CreateWorkflow] Success! Navigating to:', `/project/${activeProject.id}/flow/${groupName}/${wfName}`);
      await refreshFileTree();
      navigate(`/project/${activeProject.id}/flow/${groupName}/${wfName}`);
    } catch (err) {
      console.error('[CreateWorkflow] Exception:', err);
    }
  }, [activeProject, vnextConfig, refreshFileTree, navigate]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
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
                <div className="px-4 pb-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-[11px] font-bold shadow-sm shadow-indigo-500/20">
                    {activeProject.domain[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-slate-800 truncate block">{activeProject.domain}</span>
                  </div>
                  {activeProject.linked && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded-md font-semibold">linked</span>
                  )}
                </div>
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
            ) : (
              <div className="text-xs text-slate-400 text-center mt-12 px-4">
                No project selected.
                <br />
                <span className="text-[10px] text-slate-300">Open a project from the home page.</span>
              </div>
            )}
          </>
        )}
        {sidebarView === 'search' && (
          <div className="px-3">
            <input
              type="text"
              placeholder="Search files..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
            />
            <div className="text-[10px] text-slate-400 text-center mt-6">
              Type to search across project files
            </div>
          </div>
        )}
        {sidebarView === 'validation' && (
          <div className="text-xs text-slate-400 text-center mt-12 px-4">
            No problems detected
          </div>
        )}
        {sidebarView === 'templates' && (
          <div className="text-xs text-slate-400 text-center mt-12 px-4">
            Settings coming soon
          </div>
        )}
      </div>
    </div>
  );
}
