import { useRef, useState } from 'react';

import { deleteProject } from '@entities/project/api/project-api';
import type { ProjectInfo } from '@entities/project/model/types';
import { useAsync } from '@shared/hooks/useAsync';

interface UseDeleteProjectOptions {
  onDeleted?: (project: ProjectInfo) => Promise<void> | void;
}

export function useDeleteProject(options?: UseDeleteProjectOptions) {
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const deletingProjectRef = useRef<ProjectInfo | null>(null);

  const removeProjectAsync = useAsync(deleteProject, {
    onSuccess: async () => {
      if (deletingProjectRef.current) {
        await options?.onDeleted?.(deletingProjectRef.current);
      }
    },
  });

  async function removeProject(project: ProjectInfo) {
    deletingProjectRef.current = project;
    setDeletingProjectId(project.id);

    try {
      await removeProjectAsync.execute(project.id);
    } finally {
      setDeletingProjectId(null);
      deletingProjectRef.current = null;
    }
  }

  return {
    deletingProjectId,
    deleteError: removeProjectAsync.error,
    removeProject,
  };
}
