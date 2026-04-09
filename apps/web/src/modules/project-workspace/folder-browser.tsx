import { useEffect, useRef } from 'react';
import { ChevronRight, FolderOpen, FolderSearch } from 'lucide-react';

import type { WorkspaceFolder } from './workspace-types';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isWindowsPath = /^[A-Za-z]:[\\/]/.test(currentPath);
  const separator = isWindowsPath ? '\\' : '/';
  const normalizedSegments = currentPath.split(/[\\/]+/).filter(Boolean);
  const breadcrumbItems = normalizedSegments.map((segment, index) => {
    if (isWindowsPath) {
      const drive = normalizedSegments[0];

      if (index === 0) {
        return {
          label: segment,
          path: drive.endsWith('\\') ? drive : `${drive}\\`,
        };
      }

      return {
        label: segment,
        path: `${drive}\\${normalizedSegments.slice(1, index + 1).join('\\')}`,
      };
    }

    return {
      label: segment,
      path: `${separator}${normalizedSegments.slice(0, index + 1).join(separator)}`,
    };
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !containerRef.current.contains(target)) {
        onToggle();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, onToggle]);

  return (
    <div ref={containerRef} className={inline ? 'space-y-3' : 'relative'}>
      {!inline ? (
        <Button
          onClick={onToggle}
          className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-left text-sm shadow-sm transition-colors hover:border-slate-400">
          <FolderSearch size={16} className="shrink-0 text-slate-500" />
          {selectedPath ? (
            <span className="truncate font-mono text-xs text-slate-700">{selectedPath}</span>
          ) : (
            <span className="text-sm font-semibold text-slate-700">{placeholder}</span>
          )}
        </Button>
      ) : (
        <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-left text-sm shadow-sm">
          <FolderSearch size={16} className="shrink-0 text-slate-500" />
          {selectedPath ? (
            <span className="truncate font-mono text-xs text-slate-700">{selectedPath}</span>
          ) : (
            <span className="text-sm font-semibold text-slate-700">{placeholder}</span>
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
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-100 px-2 py-1.5 text-[11px] text-slate-500">
            {breadcrumbItems.length > 0 ? (
              breadcrumbItems.map((item, index) => {
                return (
                  <span key={item.path} className="flex shrink-0 items-center gap-0.5">
                    {index > 0 ? <ChevronRight size={8} className="text-slate-300" /> : null}
                    <Button
                      onClick={() => onNavigate(item.path)}
                      size="sm"
                      noIconHover
                      className="h-5 min-h-0 max-w-[84px] rounded-md px-1 text-[10px] leading-none font-medium shadow-none hover:text-sky-600">
                      <span className="truncate">{item.label}</span>
                    </Button>
                  </span>
                );
              })
            ) : (
              <Button
                onClick={() => onNavigate()}
                size="sm"
                noIconHover
                className="border-border-subtle h-5 min-h-0 rounded-md px-1 text-[10px] leading-none font-medium shadow-none hover:text-sky-600">
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
