import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import {
  ChevronRight,
  FileCode2,
  FileJson2,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

import type { FileTreeNode } from '@entities/project/model/types';
import { cn } from '@shared/lib/utils/cn';

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

function getFileTone(name: string): {
  label: string;
  toneClassName: string;
  icon: typeof FileText;
} {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return {
        label: '{}',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-json',
        icon: FileJson2,
      };
    case 'csx':
    case 'cs':
      return {
        label: 'C#',
        toneClassName: 'border-tertiary-border bg-tertiary-surface text-filetype-csharp',
        icon: FileCode2,
      };
    case 'js':
      return {
        label: 'JS',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-js',
        icon: FileCode2,
      };
    case 'ts':
      return {
        label: 'TS',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-ts',
        icon: FileCode2,
      };
    case 'sql':
      return {
        label: 'SQ',
        toneClassName: 'border-primary-border bg-primary-surface text-filetype-sql',
        icon: FileCode2,
      };
    case 'sh':
    case 'bash':
      return {
        label: 'SH',
        toneClassName: 'border-primary-border bg-primary-surface text-filetype-shell',
        icon: FileCode2,
      };
    case 'md':
      return {
        label: 'MD',
        toneClassName: 'border-muted-border bg-muted-surface text-muted-icon',
        icon: FileText,
      };
    case 'yaml':
    case 'yml':
      return {
        label: 'YM',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-yaml',
        icon: FileText,
      };
    case 'xml':
      return {
        label: 'XL',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-xml',
        icon: FileText,
      };
    case 'html':
      return {
        label: 'HT',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-html',
        icon: FileCode2,
      };
    case 'css':
      return {
        label: 'CS',
        toneClassName: 'border-secondary-border bg-secondary-surface text-filetype-css',
        icon: FileCode2,
      };
    case 'py':
      return {
        label: 'PY',
        toneClassName: 'border-tertiary-border bg-tertiary-surface text-filetype-python',
        icon: FileCode2,
      };
    case 'http':
      return {
        label: 'HT',
        toneClassName: 'border-primary-border bg-primary-surface text-filetype-shell',
        icon: FileCode2,
      };
    default:
      return {
        label: '~',
        toneClassName: 'border-muted-border bg-muted-surface text-muted-icon',
        icon: FileText,
      };
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
  const rowPaddingLeft = depth * 14 + 6;

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

  const handleContextMenu = useCallback((e: ReactMouseEvent) => {
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
  const childCount = node.children?.length ?? 0;
  const directoryCaption = useMemo(() => {
    if (childCount === 0) return 'empty';
    if (childCount === 1) return '1 item';
    return `${childCount} items`;
  }, [childCount]);

  if (node.type === 'file') {
    const fileTone = getFileTone(node.name);
    const FileIcon = fileTone.icon;

    if (renaming) {
      return (
        <div
          className="border-primary-border bg-primary-surface flex items-center gap-2 rounded-xl border px-2 py-1.5 shadow-sm"
          style={{ marginLeft: rowPaddingLeft }}>
          <span className="border-primary-border bg-primary text-primary-text flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border">
            <FileText className="size-3.5" />
          </span>
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
            className="border-primary-border bg-background text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-lg border px-2 text-xs outline-none"
          />
        </div>
      );
    }

    return (
      <>
        <div
          className="group hover:border-primary-border hover:bg-primary-surface/70 flex cursor-pointer items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-xs transition-all duration-150"
          style={{ marginLeft: rowPaddingLeft }}
          onClick={() => onFileClick?.(node)}
          onContextMenu={handleContextMenu}>
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[9px] font-semibold shadow-sm',
              fileTone.toneClassName,
            )}>
            <FileIcon className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-foreground truncate text-[12px] font-medium">{node.name}</div>
            <div className="text-muted-foreground truncate text-[10px] tracking-[0.12em] uppercase">
              {fileTone.label}
            </div>
          </div>
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
    <div className={cn(depth === 0 && 'space-y-1')}>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-xl border px-2 py-1.5 text-xs shadow-sm transition-all duration-150',
          expanded
            ? 'border-primary-border bg-primary-surface'
            : 'hover:border-primary-border hover:bg-primary-surface/70 border-transparent bg-transparent',
        )}
        style={{ marginLeft: rowPaddingLeft }}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={handleContextMenu}>
        <span className="bg-muted-surface text-muted-icon flex h-5 w-5 shrink-0 items-center justify-center rounded-md">
          <ChevronRight
            className={cn('size-3.5 transition-transform duration-150', expanded && 'rotate-90')}
          />
        </span>
        {expanded ? (
          <span className="border-secondary-border bg-secondary-surface text-secondary-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border shadow-sm">
            <FolderOpen className="size-3.5" />
          </span>
        ) : (
          <span className="border-muted-border bg-muted-surface text-muted-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border shadow-sm">
            <Folder className="size-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-[12px] font-semibold">{node.name}</div>
          <div className="text-muted-foreground truncate text-[10px]">{directoryCaption}</div>
        </div>
        {isWfCtx && (
          <span className="border-tertiary-border bg-tertiary-surface text-tertiary-text rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] uppercase">
            workflow
          </span>
        )}
      </div>

      {contextMenu && (
        <ContextMenu ref={menuRef} x={contextMenu.x} y={contextMenu.y} items={dirMenuItems} />
      )}

      {expanded && (
        <div className="mt-1 space-y-1">
          {creating && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl border px-2 py-1.5 shadow-sm',
                creating === 'workflow'
                  ? 'border-tertiary-border bg-tertiary-surface'
                  : 'border-primary-border bg-primary-surface',
              )}
              style={{ marginLeft: (depth + 1) * 14 + 6 }}>
              {creating === 'folder' ? (
                <span className="border-muted-border bg-muted-surface text-muted-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border">
                  <Folder className="size-3.5" />
                </span>
              ) : creating === 'workflow' ? (
                <span className="border-tertiary-border bg-tertiary text-tertiary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border">
                  <Sparkles className="size-3.5" />
                </span>
              ) : (
                <span className="border-primary-border bg-primary text-primary-text flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border">
                  <Plus className="size-3.5" />
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
                className={`bg-background text-foreground placeholder:text-muted-foreground h-7 flex-1 rounded-lg border px-2 text-xs outline-none ${
                  creating === 'workflow' ? 'border-tertiary-border' : 'border-primary-border'
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
        </div>
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
        className="animate-scale-in border-primary-border bg-background/95 shadow-foreground/10 fixed z-50 min-w-[180px] rounded-2xl border p-1.5 shadow-xl backdrop-blur-sm"
        style={{ left: x, top: y }}>
        {items.map((item, i) =>
          item.divider ? (
            <div key={i} className="border-border-subtle my-1 border-t" />
          ) : (
            <button
              key={i}
              onClick={item.action}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                item.danger
                  ? 'text-destructive-text hover:bg-destructive-surface'
                  : item.accent
                    ? 'text-tertiary-text hover:bg-tertiary-surface'
                    : 'text-foreground hover:bg-primary-surface'
              }`}>
              {item.danger ? (
                <Trash2 className="size-3.5" />
              ) : item.accent ? (
                <Sparkles className="size-3.5" />
              ) : (
                <Plus className="size-3.5 opacity-70" />
              )}
              {item.label}
            </button>
          ),
        )}
      </div>
    );
  },
);
