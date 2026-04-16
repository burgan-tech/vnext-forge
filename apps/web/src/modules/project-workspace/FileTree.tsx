import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

import { FileText, Folder } from 'lucide-react';

import type { FileTreeNode } from '@modules/project-management/ProjectTypes';
import { cn } from '@shared/lib/utils/cn';

import type { ComponentFolderType } from './componentFolderIcons';
import { FileTreeContextMenu, type FileTreeMenuItem } from './FileTreeContextMenu';
import { FileTreeNodeRow } from './FileTreeNodeRow';
import { getWorkspaceNameError, normalizeWorkspaceName } from './ProjectWorkspaceSchema';

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
  componentDirs?: Partial<Record<ComponentFolderType, string>>;
}

function detectComponentFolderType(
  nodePath: string,
  componentDirs?: Partial<Record<ComponentFolderType, string>>,
): ComponentFolderType | undefined {
  if (!componentDirs) return undefined;
  const segments = nodePath.replace(/\\/g, '/').split('/');
  let fallback: ComponentFolderType | undefined;

  for (const [type, dirName] of Object.entries(componentDirs)) {
    if (!dirName) continue;
    const idx = segments.indexOf(dirName);
    if (idx < 0) continue;
    const depthFromDir = segments.length - 1 - idx;
    if (depthFromDir > 1) continue;
    if (type === 'components_root') {
      fallback = 'components_root';
      continue;
    }
    return type as ComponentFolderType;
  }
  return fallback;
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
  componentDirs,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [creating, setCreating] = useState<'file' | 'folder' | 'workflow' | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
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

  useEffect(() => {
    setInputError(null);
  }, [creating, renaming]);

  const handleContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCreateSubmit = () => {
    if (!creating) {
      return;
    }

    const validationError = getWorkspaceNameError(newName, creating);
    if (validationError) {
      setInputError(validationError);
      return;
    }

    const parentPath = node.type === 'directory' ? node.path : node.path.replace(/\/[^/]+$/, '');
    const normalizedName = normalizeWorkspaceName(newName, creating);
    if (creating === 'file' && onCreateFile) {
      onCreateFile(parentPath, normalizedName);
    } else if (creating === 'folder' && onCreateFolder) {
      onCreateFolder(parentPath, normalizedName);
    } else if (creating === 'workflow' && onCreateWorkflow) {
      onCreateWorkflow(parentPath, normalizedName);
    }
    setCreating(null);
    setNewName('');
    setInputError(null);
  };

  const handleRenameSubmit = () => {
    const normalizedName = renameName.trim();

    if (normalizedName === node.name) {
      setRenaming(false);
      setRenameName('');
      setInputError(null);
      return;
    }

    const validationError = getWorkspaceNameError(renameName, 'rename');
    if (validationError) {
      setInputError(validationError);
      return;
    }

    if (onRenameFile) {
      onRenameFile(node.path, normalizeWorkspaceName(renameName, 'rename'));
    }
    setRenaming(false);
    setRenameName('');
    setInputError(null);
  };

  const folderType = node.type === 'directory' ? detectComponentFolderType(node.path, componentDirs) : undefined;
  const isWfCtx = folderType === 'workflows';
  if (node.type === 'file') {
    if (renaming) {
      return (
        <div style={{ paddingLeft: rowPaddingLeft }}>
          <div className="flex items-center gap-1.5 px-1.5 py-[3px]">
            <span className="text-muted-icon flex w-4 shrink-0 items-center justify-center">
              <FileText className="size-3.5" />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={renameName}
              onChange={(e) => {
                setRenameName(e.target.value);
                if (inputError) setInputError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setRenaming(false);
                  setRenameName('');
                  setInputError(null);
                }
              }}
              onBlur={handleRenameSubmit}
              className="text-foreground border-primary-border bg-background h-5 flex-1 rounded-md border px-1.5 text-xs outline-none"
            />
          </div>
          {inputError && (
            <p className="text-destructive-text mt-1 px-2 text-[11px]">{inputError}</p>
          )}
        </div>
      );
    }

    return (
      <>
        <FileTreeNodeRow
          node={node}
          depth={depth}
          onClick={() => onFileClick?.(node)}
          onContextMenu={handleContextMenu}
        />
        {contextMenu && (
          <FileTreeContextMenu
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

  const dirMenuItems: FileTreeMenuItem[] = [];
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
      <FileTreeNodeRow
        node={node}
        depth={depth}
        expanded={expanded}
        componentFolderType={folderType}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={handleContextMenu}
      />

      {contextMenu && (
        <FileTreeContextMenu ref={menuRef} x={contextMenu.x} y={contextMenu.y} items={dirMenuItems} />
      )}

      {expanded && (
        <div>
          {creating && (
            <div style={{ paddingLeft: (depth + 1) * 14 + 6 }}>
              <div className="flex items-center gap-1.5 px-1.5 py-[3px]">
                {creating === 'folder' ? (
                  <Folder className="text-muted-icon size-3.5 shrink-0" />
                ) : creating === 'workflow' ? (
                  <span className="text-tertiary-icon w-4 shrink-0 text-center text-[9px] font-bold">
                    WF
                  </span>
                ) : (
                  <span className="text-muted-icon w-4 shrink-0 text-center text-[9px] font-bold">
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
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit();
                    if (e.key === 'Escape') {
                      setCreating(null);
                      setNewName('');
                      setInputError(null);
                    }
                  }}
                  onBlur={handleCreateSubmit}
                  className={cn(
                    'text-foreground placeholder:text-muted-foreground h-5 flex-1 rounded-md border px-1.5 text-xs outline-none',
                    creating === 'workflow'
                      ? 'border-tertiary-border bg-tertiary-surface/40'
                      : 'border-primary-border bg-primary-surface/60',
                  )}
                />
              </div>
              {inputError && (
                <p className="text-destructive-text mt-1 px-2 text-[11px]">{inputError}</p>
              )}
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
              componentDirs={componentDirs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
