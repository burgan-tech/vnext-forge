import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

import type { FileTreeNode } from '@modules/project-management/project-types';

export type { FileTreeNode };

interface FileTreeProps {
  node: FileTreeNode;
  depth: number;
  onFileClick?: (node: FileTreeNode) => void;
  onCreateFile?: (parentPath: string, name: string) => void;
  onCreateFolder?: (parentPath: string, name: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newName: string) => void;
  onCreateWorkflow?: (parentPath: string, name: string) => void;
  /** Path segment to detect Workflows directories (e.g. 'Workflows') */
  workflowsDir?: string;
}

function getFileIcon(name: string): { label: string; colorClass: string } {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return { label: '{}', colorClass: 'text-filetype-json' };
    case 'csx':
    case 'cs':
      return { label: 'C#', colorClass: 'text-filetype-csharp' };
    case 'js':
      return { label: 'JS', colorClass: 'text-filetype-js' };
    case 'ts':
      return { label: 'TS', colorClass: 'text-filetype-ts' };
    case 'sql':
      return { label: 'SQ', colorClass: 'text-filetype-sql' };
    case 'sh':
    case 'bash':
      return { label: 'SH', colorClass: 'text-filetype-shell' };
    case 'md':
      return { label: 'MD', colorClass: 'text-muted-icon' };
    case 'yaml':
    case 'yml':
      return { label: 'YM', colorClass: 'text-filetype-yaml' };
    case 'xml':
      return { label: 'XL', colorClass: 'text-filetype-xml' };
    case 'html':
      return { label: 'HT', colorClass: 'text-filetype-html' };
    case 'css':
      return { label: 'CS', colorClass: 'text-filetype-css' };
    case 'py':
      return { label: 'PY', colorClass: 'text-filetype-python' };
    case 'http':
      return { label: 'HT', colorClass: 'text-filetype-shell' };
    default:
      return { label: '~', colorClass: 'text-muted-icon' };
  }
}

function isWorkflowsContext(nodePath: string, workflowsDir?: string): boolean {
  if (!workflowsDir) return false;
  const segments = nodePath.split('/');
  const wfIdx = segments.indexOf(workflowsDir);
  if (wfIdx < 0) return false;
  const depth = segments.length - 1 - wfIdx;
  return depth <= 1;
}

export function FileTree({
  node,
  depth,
  onFileClick,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  onCreateWorkflow,
  workflowsDir,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [creating, setCreating] = useState<'file' | 'folder' | 'workflow' | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  useEffect(() => {
    if ((creating || renaming) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating, renaming]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCreateSubmit = () => {
    if (!newName.trim()) {
      setCreating(null);
      return;
    }
    const parentPath = node.type === 'directory' ? node.path : node.path.replace(/\/[^/]+$/, '');
    if (creating === 'file' && onCreateFile) {
      onCreateFile(parentPath, newName.trim());
    } else if (creating === 'folder' && onCreateFolder) {
      onCreateFolder(parentPath, newName.trim());
    } else if (creating === 'workflow' && onCreateWorkflow) {
      onCreateWorkflow(parentPath, newName.trim());
    }
    setCreating(null);
    setNewName('');
  };

  const handleRenameSubmit = () => {
    if (renameName.trim() && renameName !== node.name && onRenameFile) {
      onRenameFile(node.path, renameName.trim());
    }
    setRenaming(false);
    setRenameName('');
  };

  const isWfCtx = node.type === 'directory' && isWorkflowsContext(node.path, workflowsDir);

  if (node.type === 'file') {
    const icon = getFileIcon(node.name);

    if (renaming) {
      return (
        <div
          className="flex items-center gap-1 px-1 py-0.5"
          style={{ paddingLeft: depth * 14 + 4 }}>
          <input
            ref={inputRef}
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') {
                setRenaming(false);
                setRenameName('');
              }
            }}
            onBlur={handleRenameSubmit}
            className="h-5 flex-1 rounded-md border border-primary-border bg-primary-surface px-1.5 text-xs text-foreground outline-none"
          />
        </div>
      );
    }

    return (
      <>
        <div
          className="group flex cursor-pointer items-center gap-1.5 truncate rounded-md px-1.5 py-[3px] text-xs transition-colors hover:bg-muted"
          style={{ paddingLeft: depth * 14 + 4 }}
          onClick={() => onFileClick?.(node)}
          onContextMenu={handleContextMenu}>
          <span className={`${icon.colorClass} w-4 shrink-0 text-center text-[9px] font-bold`}>
            {icon.label}
          </span>
          <span className="truncate text-muted-foreground group-hover:text-foreground">
            {node.name}
          </span>
        </div>
        {contextMenu && (
          <ContextMenu
            ref={menuRef}
            x={contextMenu.x}
            y={contextMenu.y}
            items={[
              {
                label: 'Rename',
                action: () => {
                  setRenaming(true);
                  setRenameName(node.name);
                  setContextMenu(null);
                },
              },
              {
                label: 'Delete',
                action: () => {
                  onDeleteFile?.(node.path);
                  setContextMenu(null);
                },
                danger: true,
              },
            ]}
          />
        )}
      </>
    );
  }

  const dirMenuItems: MenuItem[] = [];
  if (isWfCtx && onCreateWorkflow) {
    dirMenuItems.push({
      label: 'New Workflow',
      accent: true,
      action: () => {
        setCreating('workflow');
        setExpanded(true);
        setContextMenu(null);
      },
    });
    dirMenuItems.push({ divider: true });
  }
  dirMenuItems.push(
    {
      label: 'New File',
      action: () => {
        setCreating('file');
        setExpanded(true);
        setContextMenu(null);
      },
    },
    {
      label: 'New Folder',
      action: () => {
        setCreating('folder');
        setExpanded(true);
        setContextMenu(null);
      },
    },
    { divider: true },
    {
      label: 'Rename',
      action: () => {
        setRenaming(true);
        setRenameName(node.name);
        setContextMenu(null);
      },
    },
    {
      label: 'Delete',
      action: () => {
        onDeleteFile?.(node.path);
        setContextMenu(null);
      },
      danger: true,
    },
  );

  return (
    <div>
      <div
        className="group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-[3px] text-xs transition-colors hover:bg-muted"
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={handleContextMenu}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted-icon transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {expanded ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0 text-secondary-icon">
            <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
            <path d="M20 14H8a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0 text-muted-icon">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <span className="truncate font-medium text-muted-foreground group-hover:text-foreground">
          {node.name}
        </span>
      </div>

      {contextMenu && (
        <ContextMenu
          ref={menuRef}
          x={contextMenu.x}
          y={contextMenu.y}
          items={dirMenuItems}
        />
      )}

      {expanded && (
        <>
          {creating && (
            <div
              className="flex items-center gap-1.5 px-1.5 py-[3px]"
              style={{ paddingLeft: (depth + 1) * 14 + 4 }}>
              {creating === 'folder' ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="shrink-0 text-muted-icon">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              ) : creating === 'workflow' ? (
                <span className="w-4 shrink-0 text-center text-[9px] font-bold text-tertiary-icon">
                  WF
                </span>
              ) : (
                <span className="w-4 shrink-0 text-center text-[9px] font-bold text-muted-icon">
                  +
                </span>
              )}
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  creating === 'workflow'
                    ? 'workflow-name'
                    : creating === 'file'
                      ? 'filename.ext'
                      : 'folder-name'
                }
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubmit();
                  if (e.key === 'Escape') {
                    setCreating(null);
                    setNewName('');
                  }
                }}
                onBlur={handleCreateSubmit}
                className={`h-5 flex-1 rounded-md border px-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground ${
                  creating === 'workflow'
                    ? 'border-tertiary-border bg-tertiary-surface'
                    : 'border-primary-border bg-primary-surface'
                }`}
              />
            </div>
          )}
          {node.children?.map((child) => (
            <FileTree
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onDeleteFile={onDeleteFile}
              onRenameFile={onRenameFile}
              onCreateWorkflow={onCreateWorkflow}
              workflowsDir={workflowsDir}
            />
          ))}
        </>
      )}
    </div>
  );
}

interface MenuItem {
  label?: string;
  action?: () => void;
  danger?: boolean;
  accent?: boolean;
  divider?: boolean;
}

const ContextMenu = forwardRef<HTMLDivElement, { x: number; y: number; items: MenuItem[] }>(
  ({ x, y, items }, ref) => {
    return (
      <div
        ref={ref}
        className="animate-scale-in fixed z-50 min-w-[160px] rounded-xl border border-border bg-surface py-1.5 shadow-xl shadow-foreground/5"
        style={{ left: x, top: y }}>
        {items.map((item, i) =>
          item.divider ? (
            <div key={i} className="my-1 border-t border-border-subtle" />
          ) : (
            <button
              key={i}
              onClick={item.action}
              className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                item.danger
                  ? 'text-destructive-text hover:bg-destructive-surface'
                  : item.accent
                    ? 'font-semibold text-tertiary-text hover:bg-tertiary-surface'
                    : 'text-foreground hover:bg-muted'
              }`}>
              {item.label}
            </button>
          ),
        )}
      </div>
    );
  },
);
