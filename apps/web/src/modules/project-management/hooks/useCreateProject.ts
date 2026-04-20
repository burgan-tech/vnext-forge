import { useMemo, useState } from 'react';

import { browseWorkspace, showNotification, toVnextError } from '@vnext-forge/designer-ui';
import type { VnextForgeError } from '@vnext-forge/app-contracts';

import { createProject } from '../ProjectApi';
import { getProjectDomainError, normalizeProjectDomain } from '../ProjectManagementSchema';
import type { ProjectInfo, WorkspaceFolder } from '../ProjectTypes';

interface UseCreateProjectOptions {
  onCreated?: (project: ProjectInfo) => Promise<void> | void;
  onCreatingChange?: (creating: boolean) => void;
}

export function useCreateProject(options: UseCreateProjectOptions = {}) {
  const [domain, setDomain] = useState('');
  const [domainTouched, setDomainTouched] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [browseError, setBrowseError] = useState<VnextForgeError | null>(null);
  const [createError, setCreateError] = useState<VnextForgeError | null>(null);
  const [creating, setCreating] = useState(false);
  const domainError = useMemo(() => getProjectDomainError(domain), [domain]);
  const visibleDomainError = domainTouched ? domainError : null;

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
    setDomainTouched(true);

    if (domainError) {
      return;
    }

    const normalizedDomain = normalizeProjectDomain(domain);

    setCreating(true);
    options.onCreatingChange?.(true);
    setCreateError(null);

    showNotification({
      kind: 'info',
      message: 'Proje oluşturuluyor… Birazdan yönlendirileceksiniz.',
    });

    try {
      const response = await createProject({
        domain: normalizedDomain,
        targetPath: selectedPath || undefined,
      });

      if (!response.success) {
        throw response;
      }

      setDomain('');
      setDomainTouched(false);
      setSelectedPath('');
      setPickerOpen(false);

      showNotification({
        kind: 'success',
        message: 'Proje başarıyla oluşturuldu!',
      });

      await options.onCreated?.(response.data);
    } catch (value) {
      setCreateError(toVnextError(value, 'Project could not be created.'));
    } finally {
      setCreating(false);
      options.onCreatingChange?.(false);
    }
  };

  const canSubmit = useMemo(() => !domainError && !creating, [creating, domainError]);

  return {
    domain,
    domainError: visibleDomainError,
    setDomain: (value: string) => {
      setDomainTouched(true);
      setDomain(value);
    },
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
