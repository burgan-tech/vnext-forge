import { useCallback, useEffect, useState } from 'react';

import { useProjectStore } from '@app/store/useProjectStore';
import { listProjects } from '../ProjectApi';

import type { ProjectInfo } from '../ProjectTypes';
import type { VnextForgeError } from '@vnext-forge/app-contracts';
import { toVnextError } from '@shared/lib/error/vNextErrorHelpers';

export function useProjectList() {
  const { projects, setActiveProject, setProjects } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<VnextForgeError | null>(null);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listProjects();

      if (!response.success) {
        throw response;
      }

      setProjects(response.data);
    } catch (value) {
      setError(toVnextError(value, 'Projects could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [setProjects]);

  const selectProject = useCallback(
    (project: ProjectInfo) => {
      setActiveProject(project);
    },
    [setActiveProject],
  );

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  return {
    projects,
    loading,
    error,
    refreshProjects,
    selectProject,
  };
}
