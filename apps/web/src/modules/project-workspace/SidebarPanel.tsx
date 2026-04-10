import { Badge } from '@shared/ui/Badge';

import { FileTree } from '@modules/project-workspace/FileTree';
import { useProjectWorkspace } from './useProjectWorkspace';

export function ProjectWorkspaceSidebarPanel() {
  const {
    activeProject,
    fileTree,
    vnextConfig,
    handleFileClick,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteFile,
    handleRenameFile,
    handleCreateWorkflow,
  } = useProjectWorkspace();

  if (!activeProject) {
    return (
      <div className="px-4 pt-12">
        <div className="border-muted-border bg-muted-surface rounded-2xl border px-4 py-5 text-center shadow-sm">
          <div className="text-muted-foreground text-xs font-medium">No project selected.</div>
          <div className="text-subtle mt-1 text-[10px]">
            Open a project from the home page.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mt-2 flex items-center gap-2.5 px-4 pb-3">
        <div className="from-brand-from to-brand-to text-brand-surface-strong shadow-brand-glow/20 flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br text-[11px] font-bold shadow-sm">
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
