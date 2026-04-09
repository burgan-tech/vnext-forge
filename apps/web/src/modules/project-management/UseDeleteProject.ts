import { useState } from 'react';

import { deleteProject } from './ProjectApi';
import type { ProjectInfo } from './ProjectTypes';

import type { VnextForgeError } from '@vnext-forge/app-contracts';
import { toVnextError } from '@shared/lib/error/VnextErrorHelpers';

interface UseDeleteProjectOptions {
  onDeleted?: (project: ProjectInfo) => Promise<void> | void;
}

export function useDeleteProject(options: UseDeleteProjectOptions = {}) {
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<VnextForgeError | null>(null);

  const removeProject = async (project: ProjectInfo) => {
    setDeletingProjectId(project.id);
    setDeleteError(null);

    try {
      const response = await deleteProject(project.id);

      if (!response.success) {
        throw response;
      }

      await options.onDeleted?.(project);
    } catch (value) {
      setDeleteError(toVnextError(value, 'Project could not be deleted.'));
    } finally {
      setDeletingProjectId(null);
    }
  };

  return {
    deletingProjectId,
    deleteError,
    removeProject,
  };
}
