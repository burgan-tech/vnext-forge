import { useState } from 'react';

import { importProject } from '../ProjectApi';

import { browseWorkspace } from '@modules/project-workspace/WorkspaceApi';
import type { WorkspaceFolder } from '@shared/ui/FolderBrowser';
import type { ProjectInfo } from '../ProjectTypes';
import type { VnextForgeError } from '@vnext-forge/app-contracts';
import { toVnextError } from '@shared/lib/error/VnextErrorHelpers';

interface UseImportProjectOptions {
  onImported?: (project: ProjectInfo) => Promise<void> | void;
}

export function useImportProject(options: UseImportProjectOptions = {}) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [browseError, setBrowseError] = useState<VnextForgeError | null>(null);
  const [importError, setImportError] = useState<VnextForgeError | null>(null);
  const [importing, setImporting] = useState(false);

  const browse = async (path?: string) => {
    setBrowseError(null);

    try {
      const response = await browseWorkspace(path);

      if (!response.success) {
        throw response;
      }

      setBrowsePath(response.data.path);
      setFolders(response.data.folders);
    } catch (value) {
      setBrowseError(toVnextError(value, 'Workspace could not be browsed.'));
    }
  };

  const openDialog = async () => {
    setOpen(true);
    setImportError(null);
    await browse();
  };

  const submit = async () => {
    if (!selectedPath) {
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const response = await importProject(selectedPath);

      if (!response.success) {
        throw response;
      }

      await options.onImported?.(response.data);
      setOpen(false);
    } catch (value) {
      setImportError(toVnextError(value, 'Project could not be imported.'));
    } finally {
      setImporting(false);
    }
  };

  return {
    open,
    setOpen,
    browsePath,
    folders,
    selectedPath,
    setSelectedPath,
    browseError,
    importError,
    importing,
    browse,
    openDialog,
    submit,
  };
}
