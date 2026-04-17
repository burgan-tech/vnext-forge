import { useCallback, useEffect, useState } from 'react';

import { toVnextError, useProjectStore } from '@vnext-forge/designer-ui';
import type { VnextForgeError } from '@vnext-forge/app-contracts';

import { useProjectListStore } from '../../../app/store/useProjectListStore';
import { listProjects } from '../ProjectApi';

import type { ProjectInfo } from '../ProjectTypes';

export function useProjectList() {
  const projects = useProjectListStore((s) => s.projects);
  const setProjects = useProjectListStore((s) => s.setProjects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<VnextForgeError | null>(null);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listProjects();

      if (!response.success) {
        setError(toVnextError(response, 'Projects could not be loaded.'));
        return;
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
