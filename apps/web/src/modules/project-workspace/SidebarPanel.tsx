import { useCallback, useMemo, useState } from 'react';

import { Search, X } from 'lucide-react';

import { cn } from '@vnext-forge-studio/designer-ui';
import { Badge } from '@vnext-forge-studio/designer-ui/ui';

import { useProjectListStore } from '../../app/store/useProjectListStore';
import { buildComponentFolderRelPaths } from './componentFolderPaths';
import { FileTree } from './FileTree';
import { filterFileTree } from './filterFileTree';
import { useProjectWorkspace } from './hooks/useProjectWorkspace';
import {
  NewVnextComponentFromTreeDialog,
  type NewVnextComponentDialogState,
} from './NewVnextComponentFromTreeDialog';

export function ProjectWorkspaceSidebarPanel() {
  const fileTreeProjectId = useProjectListStore((s) => s.fileTreeProjectId);
  const fileTreeError = useProjectListStore((s) => s.fileTreeError);
  const refreshFileTree = useProjectListStore((s) => s.refreshFileTree);
  const {
    activeProject,
    fileTree,
    vnextConfig,
    handleFileClick,
    handleOpenFileInCodeEditor,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteFile,
    handleRenameFile,
    runVnextComponentOnly,
  } = useProjectWorkspace();

  const [filterQuery, setFilterQuery] = useState('');
  const [newComponentDialog, setNewComponentDialog] = useState<NewVnextComponentDialogState | null>(
    null,
  );
  const [newComponentNonce, setNewComponentNonce] = useState(0);

  const requestNewComponentDialog = useCallback((payload: NewVnextComponentDialogState) => {
    setNewComponentNonce((n) => n + 1);
    setNewComponentDialog(payload);
  }, []);

  const componentFolderRelPaths = useMemo(
    () => buildComponentFolderRelPaths(vnextConfig?.paths),
    [vnextConfig?.paths],
  );

  const treeMatchesProject =
    Boolean(fileTree) && fileTreeProjectId != null && fileTreeProjectId === activeProject?.id;

  const filteredFileTreeBranch = useMemo(() => {
    if (!treeMatchesProject || !fileTree || !activeProject) {
      return null;
    }

    const displayed = filterQuery ? filterFileTree(fileTree, filterQuery) : fileTree;

    if (!displayed) {
      return (
        <div className="text-muted-foreground px-4 py-6 text-center text-[11px]">
          No files matching <span className="font-medium">"{filterQuery}"</span>
        </div>
      );
    }
    return (
      <FileTree
        node={displayed}
        depth={0}
        onFileClick={handleFileClick}
        onOpenFileInCodeEditor={handleOpenFileInCodeEditor}
        onCreateFile={(parentPath, name) => {
          void handleCreateFile(parentPath, name);
        }}
        onCreateFolder={(parentPath, name) => {
          void handleCreateFolder(parentPath, name);
        }}
        onDeleteFile={(path) => {
          void handleDeleteFile(path);
        }}
        onRenameFile={(oldPath, newName) => {
          void handleRenameFile(oldPath, newName);
        }}
        onRequestNewComponentDialog={requestNewComponentDialog}
        projectRoot={activeProject.path}
        componentFolderRelPaths={componentFolderRelPaths}
      />
    );
  }, [
    treeMatchesProject,
    fileTree,
    activeProject,
    filterQuery,
    handleFileClick,
    handleOpenFileInCodeEditor,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteFile,
    handleRenameFile,
    componentFolderRelPaths,
    requestNewComponentDialog,
  ]);

  if (!activeProject) {
    return (
      <div className="px-4 pt-12">
        <div className="border-muted-border bg-muted-surface rounded-2xl border px-4 py-5 text-center shadow-sm">
          <div className="text-muted-foreground text-xs font-medium">No project selected.</div>
          <div className="text-subtle mt-1 text-[10px]">Open a project from the home page.</div>
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
      <div className="px-3 pb-2">
        <div
          className={cn(
            'border-secondary-border bg-secondary flex h-7 items-center gap-1.5 rounded-lg border px-2 transition-all',
            'focus-within:border-secondary-border-hover focus-within:ring-ring/40 focus-within:ring-2',
          )}>
          <Search className="text-muted-foreground size-3 shrink-0" />
          <input
            className="placeholder:text-muted-foreground/60 min-w-0 flex-1 border-0 bg-transparent text-[11px] outline-none"
            placeholder="Filter files…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="text-muted-foreground hover:text-foreground flex shrink-0 items-center justify-center transition-colors">
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1">
        {!treeMatchesProject && fileTreeError ? (
          <div className="px-4 py-6 text-center text-[11px]">
            <p className="text-muted-foreground mb-3 leading-relaxed">{fileTreeError}</p>
            <button
              type="button"
              className="text-foreground bg-secondary border-secondary-border hover:bg-secondary-hover rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
              onClick={() => {
                void refreshFileTree();
              }}>
              Retry
            </button>
          </div>
        ) : !treeMatchesProject ? (
          <div className="text-muted-foreground px-4 py-6 text-center text-[11px]">
            Loading files…
          </div>
        ) : (
          filteredFileTreeBranch
        )}
      </div>
      <NewVnextComponentFromTreeDialog
        key={newComponentNonce}
        open={newComponentDialog != null}
        state={newComponentDialog}
        projectRoot={activeProject.path}
        onOpenChange={(next) => {
          if (!next) setNewComponentDialog(null);
        }}
        runVnextComponentOnly={runVnextComponentOnly}
      />
    </div>
  );
}
