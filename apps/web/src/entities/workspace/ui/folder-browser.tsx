import { ChevronRight, FolderOpen, FolderSearch, MapPin } from 'lucide-react';

import type { WorkspaceFolder } from '@entities/workspace/model/types';
import { Button } from '@shared/ui/button';

interface FolderBrowserProps {
  currentPath: string;
  folders: WorkspaceFolder[];
  selectedPath?: string;
  emptyText?: string;
  placeholder: string;
  open: boolean;
  inline?: boolean;
  onToggle: () => void;
  onNavigate: (path?: string) => void;
  onSelect: (path: string) => void;
}

export function FolderBrowser({
  currentPath,
  folders,
  selectedPath,
  emptyText = 'No subfolders',
  placeholder,
  open,
  inline = false,
  onToggle,
  onNavigate,
  onSelect,
}: FolderBrowserProps) {
  const segments = currentPath.split('/').filter(Boolean);

  return (
    <div className={inline ? 'space-y-3' : 'relative'}>
      {!inline ? (
        <Button
          onClick={onToggle}
          className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-left text-sm transition-colors hover:border-slate-300">
          <FolderSearch size={16} className="shrink-0 text-slate-400" />
          {selectedPath ? (
            <span className="truncate font-mono text-xs text-slate-700">{selectedPath}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </Button>
      ) : (
        <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-left text-sm">
          <FolderSearch size={16} className="shrink-0 text-slate-400" />
          {selectedPath ? (
            <span className="truncate font-mono text-xs text-slate-700">{selectedPath}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
      )}

      {open ? (
        <div
          className={
            inline
              ? 'max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5'
              : 'absolute top-11 right-0 left-0 z-50 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5'
          }>
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
            {segments.length > 0 ? (
              segments.map((segment, index) => {
                const path = `/${segments.slice(0, index + 1).join('/')}`;

                return (
                  <span key={path} className="flex shrink-0 items-center gap-1">
                    {index > 0 ? <ChevronRight size={10} className="text-slate-300" /> : null}
                    <Button onClick={() => onNavigate(path)} className="hover:text-sky-600">
                      {segment}
                    </Button>
                  </span>
                );
              })
            ) : (
              <Button onClick={() => onNavigate()} className="hover:text-sky-600">
                Root
              </Button>
            )}
          </div>

          <Button
            onClick={() => onSelect(currentPath)}
            className="w-full border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold text-sky-600 hover:bg-sky-50">
            Select this folder
          </Button>

          {folders.length > 0 ? (
            folders.map((folder) => (
              <Button
                key={folder.path}
                onClick={() => onNavigate(folder.path)}
                onDoubleClick={() => onSelect(folder.path)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">
                <FolderOpen size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{folder.name}</span>
              </Button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-slate-400">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
