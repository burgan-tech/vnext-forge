import { useState } from 'react';

import { createProject } from '@entities/project/api/project-api';
import type { ProjectInfo } from '@entities/project/model/types';
import { browseWorkspace } from '@entities/workspace/api/workspace-api';
import { useAsync } from '@shared/hooks/useAsync';

interface UseCreateProjectOptions {
  onCreated?: (project: ProjectInfo) => Promise<void> | void;
}

export function useCreateProject(options?: UseCreateProjectOptions) {
  const [domain, setDomain] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const browseFolders = useAsync(browseWorkspace, {
    showNotificationOnError: false,
  });

  const create = useAsync(createProject, {
    onSuccess: async ({ data }) => {
      if (data === null) {
        return;
      }

      setDomain('');
      setSelectedPath('');
      setPickerOpen(false);
      await options?.onCreated?.(data);
    },
  });

  async function openPicker(path?: string) {
    const targetPath = path ?? (selectedPath || browseFolders.data?.path || undefined);
    await browseFolders.execute(targetPath);
    setPickerOpen(true);
  }

  async function submit() {
    const trimmedDomain = domain.trim();

    if (!trimmedDomain) {
      return;
    }

    await create.execute({
      domain: trimmedDomain,
      targetPath: selectedPath || undefined,
    });
  }

  return {
    domain,
    setDomain,
    selectedPath,
    setSelectedPath,
    pickerOpen,
    setPickerOpen,
    browsePath: browseFolders.data?.path ?? '',
    folders: browseFolders.data?.folders ?? [],
    browseError: browseFolders.error,
    creating: create.loading,
    createError: create.error,
    canSubmit: domain.trim().length > 0 && !create.loading,
    openPicker,
    submit,
  };
}
