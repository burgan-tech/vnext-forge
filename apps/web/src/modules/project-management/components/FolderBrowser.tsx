import { useEffect, useRef } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderSearch,
  HardDrive,
  Monitor,
} from 'lucide-react';

import { Button, cn } from '@vnext-forge/designer-ui';

import type { WorkspaceFolder } from '../ProjectTypes';

const SYSTEM_ROOT_TOKEN = '::system-root::';

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
  const isWindowsDriveList =
    !currentPath && folders.some((folder) => /^[A-Za-z]:\\?$/.test(folder.path));
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

  const isCurrentPathSelected = Boolean(currentPath) && currentPath === selectedPath;

  return (
    <div ref={containerRef} className={inline ? '' : 'relative'}>
      {!inline ? (
        <Button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'h-11 min-h-11 w-full justify-start rounded-xl text-left text-sm shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 ease-out',
            'active:bg-primary-muted',
            open && 'border-primary-border-hover ring-ring/35 ring-[3px]',
            '[&>span]:w-full [&>span]:min-w-0 [&>span]:max-w-full [&>span]:justify-start [&>span]:gap-0 [&>span]:px-3.5 [&>span]:py-2',
          )}>
          <span className="flex w-full min-w-0 items-center gap-2">
            <FolderSearch size={16} className="text-primary-icon shrink-0" aria-hidden />
            {selectedPath ? (
              <span className="text-foreground min-w-0 flex-1 truncate font-mono text-sm font-semibold">
                {selectedPath}
              </span>
            ) : (
              <span className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">
                {placeholder}
              </span>
            )}
            <ChevronDown
              size={16}
              className={cn(
                'text-muted-icon group-hover/button:text-primary-icon ml-auto shrink-0 transition-transform duration-200 ease-out',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </span>
        </Button>
      ) : null}

      {open ? (
        <div
          className={
            inline
              ? 'border-border bg-surface overflow-hidden rounded-xl border shadow-sm'
              : 'border-border bg-surface absolute top-11 right-0 left-0 z-50 overflow-hidden rounded-xl border shadow-sm'
          }>
          {inline ? (
            <div className="border-border-subtle bg-muted text-muted-foreground flex items-center gap-2 border-b px-3 py-2 text-xs">
              <FolderSearch size={14} className="text-muted-icon shrink-0" />
              {selectedPath ? (
                <>
                  <span className="text-muted-foreground font-semibold">Selected:</span>
                  <span
                    className="text-foreground truncate font-mono text-sm font-semibold"
                    title={selectedPath}>
                    {selectedPath}
                  </span>
                </>
              ) : (
                <span className="text-secondary-text truncate text-sm font-semibold">{placeholder}</span>
              )}
            </div>
          ) : null}

          <div className="border-border-subtle bg-muted/60 text-muted-foreground flex items-center gap-1 overflow-x-auto border-b px-2.5 py-1.5 text-xs">
            <button
              type="button"
              onClick={() => onNavigate(SYSTEM_ROOT_TOKEN)}
              className="text-muted-foreground hover:bg-muted-hover hover:text-foreground inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 font-medium transition-colors duration-150 ease-out"
              aria-label="System root">
              <Monitor size={12} className="shrink-0" />
            </button>
            {breadcrumbItems.map((item) => (
              <span key={item.path} className="flex shrink-0 items-center gap-0.5">
                <ChevronRight size={10} className="text-subtle shrink-0" />
                <button
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className="text-secondary-text hover:bg-muted-hover hover:text-foreground inline-flex h-6 max-w-[120px] cursor-pointer items-center rounded-md px-1.5 font-medium transition-colors duration-150 ease-out">
                  <span className="truncate">{item.label}</span>
                </button>
              </span>
            ))}
          </div>

          <div className={inline ? 'max-h-72 overflow-y-auto' : 'max-h-60 overflow-y-auto'}>
            {currentPath ? (
              <button
                type="button"
                onClick={() => onSelect(currentPath)}
                aria-pressed={isCurrentPathSelected}
                className={
                  'border-border-subtle flex w-full cursor-pointer items-center justify-between gap-2 border-b px-3 py-2 text-left text-xs font-semibold transition-colors duration-150 ease-out ' +
                  (isCurrentPathSelected
                    ? 'bg-primary-muted text-foreground hover:bg-primary-muted-hover'
                    : 'text-foreground hover:bg-muted')
                }>
                <span className="truncate">
                  {isCurrentPathSelected ? 'Selected this folder' : 'Select this folder'}
                </span>
                {isCurrentPathSelected ? (
                  <Check size={13} className="text-primary-icon shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            ) : null}

            {folders.length > 0 ? (
              folders.map((folder) => {
                const isFolderSelected = folder.path === selectedPath;

                return (
                  <button
                    type="button"
                    key={folder.path}
                    onClick={() => onNavigate(folder.path)}
                    onDoubleClick={() => onSelect(folder.path)}
                    className={
                      'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors duration-150 ease-out ' +
                      (isFolderSelected
                        ? 'bg-primary-muted text-foreground hover:bg-primary-muted-hover'
                        : 'text-foreground hover:bg-muted')
                    }>
                    {isWindowsDriveList ? (
                      <HardDrive
                        size={13}
                        className={
                          isFolderSelected
                            ? 'text-primary-icon shrink-0'
                            : 'text-muted-icon shrink-0'
                        }
                      />
                    ) : (
                      <FolderOpen
                        size={13}
                        className={
                          isFolderSelected
                            ? 'text-primary-icon shrink-0'
                            : 'text-muted-icon shrink-0'
                        }
                      />
                    )}
                    <span className="truncate">{folder.name}</span>
                    {isFolderSelected ? (
                      <Check
                        size={12}
                        className="text-primary-icon ml-auto shrink-0"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="text-muted-foreground px-3 py-2 text-xs">{emptyText}</div>
            )}
          </div>

        </div>
      ) : null}
    </div>
  );
}
