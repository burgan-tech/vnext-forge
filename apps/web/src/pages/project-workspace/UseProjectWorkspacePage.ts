import { useEffect } from 'react';

import {
  getProject,
  getProjectConfig,
  getProjectTree,
} from '@modules/project-management/ProjectApi';
import { useProjectStore } from '@modules/project-management/ProjectStore';
import { createLogger } from '@shared/lib/logger/CreateLogger';

const logger = createLogger('ProjectWorkspacePage');

export function useProjectWorkspacePage(projectId?: string) {
  const {
    setActiveProject,
    setError,
    setFileTree,
    setLoading,
    setVnextConfig,
  } = useProjectStore();

  useEffect(() => {
    if (!projectId) {
      setActiveProject(null);
      setFileTree(null);
      setVnextConfig(null);
      setError('Project could not be resolved.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProject = async () => {
      setLoading(true);
      setError(null);

      try {
        const [projectResponse, treeResponse, configResponse] = await Promise.all([
          getProject(projectId),
          getProjectTree(projectId),
          getProjectConfig(projectId),
        ]);

        if (!projectResponse.success) {
          throw new Error(projectResponse.error.message);
        }

        if (!treeResponse.success) {
          throw new Error(treeResponse.error.message);
        }

        if (cancelled) {
          return;
        }

        setActiveProject(projectResponse.data);
        setFileTree(treeResponse.data);

        if (configResponse.success) {
          setVnextConfig(configResponse.data);
        } else {
          setVnextConfig(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        logger.error('Project workspace could not be loaded.', {
          error,
          projectId,
        });

        setActiveProject(null);
        setFileTree(null);
        setVnextConfig(null);
        setError('Project could not be loaded.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [projectId, setActiveProject, setError, setFileTree, setLoading, setVnextConfig]);
}
