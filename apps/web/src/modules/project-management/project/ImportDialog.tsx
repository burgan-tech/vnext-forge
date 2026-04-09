import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Folder,
  ChevronRight,
  ChevronUp,
  Home,
  Check,
  Loader2,
  CornerDownRight,
} from 'lucide-react';
import { importProject } from '@modules/project-management/project-api';
import { browseWorkspace } from '@modules/project-workspace/workspace-api';
import type { WorkspaceFolder } from '@modules/project-workspace/workspace-types';

type FolderEntry = WorkspaceFolder & {
  hasVnextConfig?: boolean;
};

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: ImportDialogProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (path?: string) => {
    setBrowsing(true);
    setError(null);
    try {
      const data = await browseWorkspace(path);
      setCurrentPath(data.path);
      setFolders(data.folders as FolderEntry[]);
      setSelectedPath(null);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBrowsing(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      browse();
      setSelectedPath(null);
      setError(null);
    }
  }, [open, browse]);

  function navigateUp() {
    const parent = currentPath.replace(/\/[^/]+$/, '') || '/';
    browse(parent);
  }

  function selectFolder(folder: FolderEntry) {
    setSelectedPath(folder.path);
  }

  function openFolder(folder: FolderEntry) {
    browse(folder.path);
  }

  async function handleImport() {
    if (!selectedPath) return;
    setImporting(true);
    setError(null);
    try {
      await importProject(selectedPath);
      onOpenChange(false);
      onImported();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setImporting(false);
    }
  }

  const pathSegments = currentPath.split('/').filter(Boolean);
  const selectedFolder = folders.find((f) => f.path === selectedPath);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl shadow-black/10 w-[640px] max-w-[95vw] z-50 flex flex-col overflow-hidden ring-1 ring-black/5">

          {/* Title bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
            <Dialog.Title className="text-sm font-semibold text-slate-900">
              Import Project
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                <X size={14} />
              </button>
            </Dialog.Close>
            <Dialog.Description className="sr-only">
              Browse folders to select a vnext project to import
            </Dialog.Description>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50/50 border-b border-slate-100">
            <button
              onClick={() => browse()}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Home"
            >
              <Home size={15} />
            </button>
            <button
              onClick={navigateUp}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Up"
            >
              <ChevronUp size={15} />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-0.5 text-xs text-slate-500 overflow-x-auto flex-1 min-w-0">
              <button
                onClick={() => browse('/')}
                className="px-1.5 py-1 rounded hover:bg-slate-100 hover:text-slate-700 shrink-0 transition-colors"
              >
                /
              </button>
              {pathSegments.map((seg, i) => {
                const fullPath = '/' + pathSegments.slice(0, i + 1).join('/');
                const isLast = i === pathSegments.length - 1;
                return (
                  <div key={fullPath} className="flex items-center shrink-0">
                    <ChevronRight size={11} className="text-slate-300" />
                    <button
                      onClick={() => browse(fullPath)}
                      className={`px-1.5 py-1 rounded transition-colors truncate max-w-32 ${isLast ? 'text-slate-900 font-medium' : 'hover:bg-slate-100 hover:text-slate-700'}`}
                    >
                      {seg}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto min-h-[320px] max-h-[420px] bg-white">
            {browsing ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={18} className="animate-spin text-slate-400" />
              </div>
            ) : folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Folder size={28} className="mb-2 opacity-40" />
                <span className="text-sm">Empty folder</span>
              </div>
            ) : (
              <div className="py-1">
                {folders.map((folder) => {
                  const isSelected = selectedPath === folder.path;
                  return (
                    <div
                      key={folder.path}
                      onClick={() => selectFolder(folder)}
                      onDoubleClick={() => openFolder(folder)}
                      className={`flex items-center gap-3 px-4 py-2 cursor-default select-none transition-colors ${
                        isSelected
                          ? 'bg-indigo-500 text-white'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Folder
                        size={16}
                        className={isSelected ? 'text-white' : 'text-indigo-400'}
                        fill={isSelected ? 'white' : '#93c5fd'}
                        strokeWidth={0}
                      />
                      <span className="flex-1 text-sm truncate">{folder.name}</span>
                      {folder.hasVnextConfig && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-green-50 text-green-600 ring-1 ring-green-200'
                          }`}
                        >
                          <Check size={9} />
                          vnext
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openFolder(folder);
                        }}
                        className={`w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'hover:bg-white/20 text-white/70 hover:text-white'
                            : 'hover:bg-slate-100 text-slate-300 hover:text-slate-500'
                        }`}
                        title="Open folder"
                      >
                        <CornerDownRight size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
                {error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {selectedPath ? (
                  <div className="text-xs text-slate-500 font-mono truncate">{selectedPath}</div>
                ) : (
                  <div className="text-xs text-slate-400">Select a folder to import</div>
                )}
                {selectedFolder && !selectedFolder.hasVnextConfig && selectedPath && (
                  <div className="text-[10px] text-amber-600 mt-0.5">
                    No vnext.config.json found in this folder
                  </div>
                )}
              </div>
              <Dialog.Close asChild>
                <button className="px-4 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={handleImport}
                disabled={importing || !selectedPath}
                className="px-5 py-1.5 text-sm font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 disabled:opacity-40 disabled:hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
              >
                {importing && <Loader2 size={13} className="animate-spin" />}
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
