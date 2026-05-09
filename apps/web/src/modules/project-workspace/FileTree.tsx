import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

import { Folder, FileText } from 'lucide-react';

import {
  getWorkspaceNameError,
  normalizeWorkspaceName,
  type ComponentFolderType,
  type FileTreeNode,
  type VnextComponentType,
} from '@vnext-forge-studio/designer-ui';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@vnext-forge-studio/designer-ui/ui';
import {
  matchComponentFolderType,
  matchVnextDomainComponentFolder,
} from './componentFolderPaths';
import { FileTreeContextMenu, type FileTreeMenuItem } from './FileTreeContextMenu';
import { FileTreeNodeRow } from './FileTreeNodeRow';

export type { FileTreeNode };

const NEW_COMPONENT_ITEM_LABEL: Record<VnextComponentType, string> = {
  workflow: 'New Workflow',
  task: 'New Task',
  schema: 'New Schema',
  view: 'New View',
  function: 'New Function',
  extension: 'New Extension',
};

interface FileTreeProps {
  node: FileTreeNode;
  depth: number;
  onFileClick?: (node: FileTreeNode) => void;
  /** For `.json` files: open in code editor instead of the designer route. */
  onOpenFileInCodeEditor?: (node: FileTreeNode) => void;
  onCreateFile?: (parentPath: string, name: string) => void;
  onCreateFolder?: (parentPath: string, name: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newName: string) => void;
  /** Opens the new-component dialog (web shell). */
  onRequestNewComponentDialog?: (payload: { kind: VnextComponentType; parentPath: string }) => void;
  projectRoot?: string;
  componentFolderRelPaths?: Partial<Record<ComponentFolderType, string>>;
}

export function FileTree({
  node,
  depth,
  onFileClick,
  onOpenFileInCodeEditor,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  onRequestNewComponentDialog,
  projectRoot,
  componentFolderRelPaths,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
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
    }
    setCreating(null);
    setNewName('');
    setInputError(null);
  };

  const cancelPlainCreate = () => {
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

  const folderType =
    node.type === 'directory'
      ? matchComponentFolderType(node.path, projectRoot, componentFolderRelPaths)
      : undefined;

  const vnextDomainClass =
    node.type === 'directory' && projectRoot && componentFolderRelPaths
      ? matchVnextDomainComponentFolder(node.path, projectRoot, componentFolderRelPaths)
      : null;

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

    const isJsonFile = node.name.toLowerCase().endsWith('.json');
    const fileMenuItems: FileTreeMenuItem[] = [];
    if (isJsonFile && onOpenFileInCodeEditor) {
      fileMenuItems.push({
        label: 'Open in Code editor',
        accent: true,
        action: () => {
          onOpenFileInCodeEditor(node);
          setContextMenu(null);
        },
      });
      fileMenuItems.push({ divider: true });
    }
    fileMenuItems.push(
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
      <>
        <FileTreeNodeRow
          node={node}
          depth={depth}
          onClick={() => onFileClick?.(node)}
          onContextMenu={handleContextMenu}
        />
        {contextMenu && (
          <FileTreeContextMenu ref={menuRef} x={contextMenu.x} y={contextMenu.y} items={fileMenuItems} />
        )}
      </>
    );
  }

  const openNewComponentItem =
    vnextDomainClass && onRequestNewComponentDialog ? (
      <>
        <ContextMenuItem
          onSelect={() => {
            onRequestNewComponentDialog({
              kind: vnextDomainClass.componentKind,
              parentPath: node.path,
            });
          }}>
          {NEW_COMPONENT_ITEM_LABEL[vnextDomainClass.componentKind]}
        </ContextMenuItem>
        <ContextMenuSeparator />
      </>
    ) : null;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <FileTreeNodeRow
            node={node}
            depth={depth}
            expanded={expanded}
            componentFolderType={folderType}
            onClick={() => setExpanded(!expanded)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[10rem]">
          {openNewComponentItem}
          <ContextMenuItem
            onSelect={() => {
              setInputError(null);
              setNewName('');
              setCreating('file');
              setExpanded(true);
            }}>
            New File
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              setInputError(null);
              setNewName('');
              setCreating('folder');
              setExpanded(true);
            }}>
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              setRenaming(true);
              setRenameName(node.name);
            }}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onSelect={() => {
              onDeleteFile?.(node.path);
            }}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && (
        <div>
          {creating && (
            <div style={{ paddingLeft: (depth + 1) * 14 + 6 }}>
              <div className="flex items-center gap-1.5 px-1.5 py-[3px]">
                {creating === 'folder' ? (
                  <Folder className="text-muted-icon size-3.5 shrink-0" />
                ) : (
                  <span className="text-muted-icon w-4 shrink-0 text-center text-[9px] font-bold">
                    +
                  </span>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={creating === 'file' ? 'filename.ext' : 'folder-name'}
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit();
                    if (e.key === 'Escape') {
                      cancelPlainCreate();
                    }
                  }}
                  onBlur={cancelPlainCreate}
                  className="text-foreground border-primary-border bg-primary-surface/60 h-5 flex-1 rounded-md border px-1.5 text-xs outline-none"
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
              onOpenFileInCodeEditor={onOpenFileInCodeEditor}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onDeleteFile={onDeleteFile}
              onRenameFile={onRenameFile}
              onRequestNewComponentDialog={onRequestNewComponentDialog}
              projectRoot={projectRoot}
              componentFolderRelPaths={componentFolderRelPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}
