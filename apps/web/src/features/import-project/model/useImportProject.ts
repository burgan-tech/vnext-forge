import { useState } from 'react';

import { importProject } from '@entities/project/api/project-api';
import type { ProjectInfo } from '@entities/project/model/types';
import { browseWorkspace } from '@entities/workspace/api/workspace-api';
import { useAsync } from '@shared/hooks/useAsync';

interface UseImportProjectOptions {
  onImported?: (project: ProjectInfo) => Promise<void> | void;
}

export function useImportProject(options?: UseImportProjectOptions) {
  const [open, setOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const browseFolders = useAsync(browseWorkspace, {
    showNotificationOnError: false,
  });

  const runImport = useAsync(importProject, {
    onSuccess: async ({ data }) => {
      if (data === null) {
        return;
      }

      setOpen(false);
      setSelectedPath('');
      await options?.onImported?.(data);
    },
  });

  async function openDialog() {
    setOpen(true);

    if (!browseFolders.data) {
      await browseFolders.execute();
    }
  }

  async function browse(path?: string) {
    await browseFolders.execute(path);
  }

  async function submit() {
    if (!selectedPath) {
      return;
    }

    await runImport.execute(selectedPath);
  }

  return {
    open,
    setOpen,
    selectedPath,
    setSelectedPath,
    browsePath: browseFolders.data?.path ?? '',
    folders: browseFolders.data?.folders ?? [],
    browseError: browseFolders.error,
    importError: runImport.error,
    importing: runImport.loading,
    openDialog,
    browse,
    submit,
  };
}
