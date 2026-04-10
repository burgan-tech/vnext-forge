import { useMemo, useState } from 'react';

import { createProject } from '../ProjectApi';

import { browseWorkspace } from '@modules/project-workspace/WorkspaceApi';
import type { WorkspaceFolder } from '@shared/ui/FolderBrowser';
import type { ProjectInfo } from '../ProjectTypes';
import type { VnextForgeError } from '@vnext-forge/app-contracts';
import { toVnextError } from '@shared/lib/error/VnextErrorHelpers';

interface UseCreateProjectOptions {
  onCreated?: (project: ProjectInfo) => Promise<void> | void;
}

export function useCreateProject(options: UseCreateProjectOptions = {}) {
  const [domain, setDomain] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [browseError, setBrowseError] = useState<VnextForgeError | null>(null);
  const [createError, setCreateError] = useState<VnextForgeError | null>(null);
  const [creating, setCreating] = useState(false);

  const openPicker = async (path?: string) => {
    setBrowseError(null);

    try {
      const response = await browseWorkspace(path);

      if (!response.success) {
        throw response;
      }

      setBrowsePath(response.data.path);
      setFolders(response.data.folders);
      setPickerOpen(true);
    } catch (value) {
      setBrowseError(toVnextError(value, 'Workspace could not be browsed.'));
    }
  };

  const submit = async () => {
    const normalizedDomain = domain.trim();

    if (!normalizedDomain) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await createProject({
        domain: normalizedDomain,
        targetPath: selectedPath || undefined,
      });

      if (!response.success) {
        throw response;
      }

      setDomain('');
      setSelectedPath('');
      setPickerOpen(false);
      await options.onCreated?.(response.data);
    } catch (value) {
      setCreateError(toVnextError(value, 'Project could not be created.'));
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = useMemo(() => domain.trim().length > 0 && !creating, [creating, domain]);

  return {
    domain,
    setDomain,
    pickerOpen,
    setPickerOpen,
    browsePath,
    folders,
    selectedPath,
    setSelectedPath,
    browseError,
    createError,
    creating,
    canSubmit,
    openPicker,
    submit,
  };
}
