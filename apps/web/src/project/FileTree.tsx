import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

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

// File type icon based on extension
function getFileIcon(name: string): { label: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json': return { label: '{}', color: 'text-amber-500' };
    case 'csx': case 'cs': return { label: 'C#', color: 'text-violet-500' };
    case 'js': return { label: 'JS', color: 'text-yellow-500' };
    case 'ts': return { label: 'TS', color: 'text-blue-500' };
    case 'sql': return { label: 'SQ', color: 'text-orange-500' };
    case 'sh': case 'bash': return { label: 'SH', color: 'text-emerald-500' };
    case 'md': return { label: 'MD', color: 'text-slate-400' };
    case 'yaml': case 'yml': return { label: 'YM', color: 'text-rose-400' };
    case 'xml': return { label: 'XL', color: 'text-orange-400' };
    case 'html': return { label: 'HT', color: 'text-rose-500' };
    case 'css': return { label: 'CS', color: 'text-blue-400' };
    case 'py': return { label: 'PY', color: 'text-blue-600' };
    case 'http': return { label: 'HT', color: 'text-emerald-600' };
    default: return { label: '~', color: 'text-slate-400' };
  }
}

/** Check if a directory path is inside a Workflows directory (depth 1 or 2 under Workflows) */
function isWorkflowsContext(nodePath: string, workflowsDir?: string): boolean {
  if (!workflowsDir) return false;
  // Match paths like: .../Workflows or .../Workflows/group-name
  const segments = nodePath.split('/');
  const wfIdx = segments.indexOf(workflowsDir);
  if (wfIdx < 0) return false;
  // depth from Workflows: 0 = Workflows itself, 1 = group folder
  const depth = segments.length - 1 - wfIdx;
  return depth <= 1;
}

export function FileTree({ node, depth, onFileClick, onCreateFile, onCreateFolder, onDeleteFile, onRenameFile, onCreateWorkflow, workflowsDir }: FileTreeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [creating, setCreating] = useState<'file' | 'folder' | 'workflow' | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
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

  // Auto focus input
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
    if (!newName.trim()) { setCreating(null); return; }
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

  // Render file
  if (node.type === 'file') {
    const icon = getFileIcon(node.name);

    if (renaming) {
      return (
        <div className="flex items-center gap-1 py-0.5 px-1" style={{ paddingLeft: depth * 14 + 4 }}>
          <input
            ref={inputRef}
            type="text"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') { setRenaming(false); setRenameName(''); }
            }}
            onBlur={handleRenameSubmit}
            className="flex-1 h-5 px-1.5 text-xs border border-indigo-300 rounded-md bg-indigo-50/50 text-slate-900 outline-none"
          />
        </div>
      );
    }

    return (
      <>
        <div
          className="flex items-center gap-1.5 py-[3px] px-1.5 text-xs hover:bg-indigo-50/60 rounded-md cursor-pointer truncate group transition-colors"
          style={{ paddingLeft: depth * 14 + 4 }}
          onClick={() => onFileClick?.(node)}
          onContextMenu={handleContextMenu}
        >
          <span className={`${icon.color} w-4 text-center text-[9px] font-bold shrink-0`}>{icon.label}</span>
          <span className="truncate text-slate-600 group-hover:text-slate-900">{node.name}</span>
        </div>
        {contextMenu && (
          <ContextMenu
            ref={menuRef}
            x={contextMenu.x}
            y={contextMenu.y}
            items={[
              { label: 'Rename', action: () => { setRenaming(true); setRenameName(node.name); setContextMenu(null); } },
              { label: 'Delete', action: () => { onDeleteFile?.(node.path); setContextMenu(null); }, danger: true },
            ]}
          />
        )}
      </>
    );
  }

  // Build directory context menu items
  const dirMenuItems: MenuItem[] = [];
  if (isWfCtx && onCreateWorkflow) {
    dirMenuItems.push({
      label: 'New Workflow',
      accent: true,
      action: () => { setCreating('workflow'); setExpanded(true); setContextMenu(null); },
    });
    dirMenuItems.push({ divider: true });
  }
  dirMenuItems.push(
    { label: 'New File', action: () => { setCreating('file'); setExpanded(true); setContextMenu(null); } },
    { label: 'New Folder', action: () => { setCreating('folder'); setExpanded(true); setContextMenu(null); } },
    { divider: true },
    { label: 'Rename', action: () => { setRenaming(true); setRenameName(node.name); setContextMenu(null); } },
    { label: 'Delete', action: () => { onDeleteFile?.(node.path); setContextMenu(null); }, danger: true },
  );

  // Render directory
  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-[3px] px-1.5 text-xs hover:bg-indigo-50/60 rounded-md cursor-pointer group transition-colors"
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={handleContextMenu}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {expanded ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-indigo-400">
            <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
            <path d="M20 14H8a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-slate-400">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <span className="font-medium truncate text-slate-600 group-hover:text-slate-900">{node.name}</span>
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
          {/* Inline input for new file/folder/workflow */}
          {creating && (
            <div className="flex items-center gap-1.5 py-[3px] px-1.5" style={{ paddingLeft: (depth + 1) * 14 + 4 }}>
              {creating === 'folder' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-indigo-400">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              ) : creating === 'workflow' ? (
                <span className="text-emerald-500 text-[9px] font-bold w-4 text-center shrink-0">WF</span>
              ) : (
                <span className="text-slate-400 text-[9px] font-bold w-4 text-center shrink-0">+</span>
              )}
              <input
                ref={inputRef}
                type="text"
                placeholder={creating === 'workflow' ? 'workflow-name' : creating === 'file' ? 'filename.ext' : 'folder-name'}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubmit();
                  if (e.key === 'Escape') { setCreating(null); setNewName(''); }
                }}
                onBlur={handleCreateSubmit}
                className={`flex-1 h-5 px-1.5 text-xs border rounded-md outline-none placeholder:text-slate-400 ${
                  creating === 'workflow'
                    ? 'border-emerald-300 bg-emerald-50/50 text-slate-900'
                    : 'border-indigo-300 bg-indigo-50/50 text-slate-900'
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

// Context Menu component
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
        className="fixed z-50 min-w-[160px] py-1.5 bg-white/95 backdrop-blur-xl rounded-xl border border-slate-200/80 shadow-xl shadow-slate-900/10 animate-scale-in"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) =>
          item.divider ? (
            <div key={i} className="my-1 border-t border-slate-100" />
          ) : (
            <button
              key={i}
              onClick={item.action}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                item.danger
                  ? 'text-rose-500 hover:bg-rose-50'
                  : item.accent
                    ? 'text-emerald-600 hover:bg-emerald-50 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    );
  }
);
