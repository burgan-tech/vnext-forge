import { useEffect } from 'react';

import { listProjects } from '@entities/project/api/project-api';
import { useProjectStore } from '@entities/project/model/project-store';
import { type ProjectInfo } from '@entities/project/model/types';
import { useAsync } from '@shared/hooks/useAsync';

export function useProjectList() {
  const { projects, loading, setActiveProject, setError, setLoading, setProjects } = useProjectStore();

  const loadProjects = useAsync(listProjects, {
    showNotificationOnError: false,
    onSuccess: ({ data }) => {
      if (data === null) {
        return;
      }

      setProjects(data);
      setError(null);
    },
    onError: (error) => {
      setProjects([]);
      setError(error.toUserMessage().message);
    },
  });

  useEffect(() => {
    void loadProjects.execute();
  }, [loadProjects.execute]);

  useEffect(() => {
    setLoading(loadProjects.loading);
  }, [loadProjects.loading, setLoading]);

  function selectProject(project: ProjectInfo) {
    setActiveProject(project);
  }

  return {
    projects,
    loading,
    error: loadProjects.error,
    refreshProjects: loadProjects.execute,
    selectProject,
  };
}
