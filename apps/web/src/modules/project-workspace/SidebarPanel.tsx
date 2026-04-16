import { useMemo, useState } from 'react';

import { Search, X } from 'lucide-react';

import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/lib/utils/cn';

import { FileTree } from '@modules/project-workspace/FileTree';
import type { ComponentFolderType } from './componentFolderIcons';
import { filterFileTree } from './filterFileTree';
import { useProjectWorkspace } from './hooks/useProjectWorkspace';

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

  const [filterQuery, setFilterQuery] = useState('');

  const componentDirs = useMemo((): Partial<Record<ComponentFolderType, string>> | undefined => {
    const p = vnextConfig?.paths;
    if (!p) return undefined;
    return {
      components_root: p.componentsRoot?.split('/').pop() || undefined,
      workflows: p.workflows?.split('/').pop() || 'Workflows',
      tasks: p.tasks?.split('/').pop() || 'Tasks',
      schemas: p.schemas?.split('/').pop() || 'Schemas',
      views: p.views?.split('/').pop() || 'Views',
      functions: p.functions?.split('/').pop() || 'Functions',
      extensions: p.extensions?.split('/').pop() || 'Extensions',
    };
  }, [vnextConfig?.paths]);

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
        {fileTree ? (() => {
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
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
              onCreateWorkflow={handleCreateWorkflow}
              componentDirs={componentDirs}
            />
          );
        })() : null}
      </div>
    </div>
  );
}
