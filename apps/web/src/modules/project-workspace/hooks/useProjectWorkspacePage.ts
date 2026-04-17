import { useCallback, useEffect } from 'react';

import { createLogger, getProjectTree, useProjectStore } from '@vnext-forge/designer-ui';

import { useComponentFileTypesStore } from '../../../app/store/useComponentFileTypesStore';
import { useProjectListStore } from '../../../app/store/useProjectListStore';
import { useVnextWorkspaceUiStore } from '../../../app/store/useVnextWorkspaceUiStore';
import { useWorkspaceDiagnosticsStore } from '../../../app/store/useWorkspaceDiagnosticsStore';
import { getProject, getProjectConfigStatus } from '../../project-management/ProjectApi';
import { applyProjectConfigStatus } from '../applyProjectConfigStatus';
import {
  loadComponentFileTypes,
  refreshWorkspaceLayoutAndValidateScript,
} from '../syncVnextWorkspaceFromDisk';

const logger = createLogger('useProjectWorkspacePage');

export interface ProjectWorkspacePageController {
  reloadProjectWorkspace: () => Promise<void>;
}

/**
 * Proje çalışma alanı bootstrap: proje meta + config `ProjectApi`, ağaç `WorkspaceApi`.
 */
export function useProjectWorkspacePage(projectId?: string): ProjectWorkspacePageController {
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setVnextConfig = useProjectStore((s) => s.setVnextConfig);
  const setLoading = useProjectStore((s) => s.setLoading);
  const setError = useProjectStore((s) => s.setError);
  const setFileTree = useProjectListStore((s) => s.setFileTree);
  const clearConfigIssues = useWorkspaceDiagnosticsStore((s) => s.clearConfigIssues);
  const resetVnextWorkspaceUi = useVnextWorkspaceUiStore((s) => s.resetVnextWorkspaceUi);

  const applyConfigStatus = useCallback(
    (status: Awaited<ReturnType<typeof getProjectConfigStatus>>) => {
      applyProjectConfigStatus(status, {
        openWizardOnMissing: true,
      });
    },
    [],
  );

  const reloadProjectWorkspace = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setLoading(true);
    setError(null);
    clearConfigIssues();

    try {
      const [projectResponse, treeResponse, statusResponse] = await Promise.all([
        getProject(projectId),
        getProjectTree(projectId),
        getProjectConfigStatus(projectId),
      ]);

      if (!projectResponse.success) {
        throw new Error(projectResponse.error.message);
      }

      if (!treeResponse.success) {
        throw new Error(treeResponse.error.message);
      }

      setActiveProject(projectResponse.data);
      setFileTree(treeResponse.data);
      applyConfigStatus(statusResponse);
      if (statusResponse.success && statusResponse.data.status === 'ok') {
        await Promise.all([
          refreshWorkspaceLayoutAndValidateScript(projectId),
          loadComponentFileTypes(projectId),
        ]);
      }
    } catch (error) {
      logger.error('Project workspace could not be loaded.', {
        error,
        projectId,
      });

      setActiveProject(null);
      setFileTree(null);
      setVnextConfig(null);
      clearConfigIssues();
      resetVnextWorkspaceUi();
      useComponentFileTypesStore.getState().clearFileTypes();
      setError('Project could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [
    applyConfigStatus,
    clearConfigIssues,
    projectId,
    setActiveProject,
    setError,
    setFileTree,
    setLoading,
    setVnextConfig,
    resetVnextWorkspaceUi,
  ]);

  useEffect(() => {
    if (!projectId) {
      setActiveProject(null);
      setFileTree(null);
      setVnextConfig(null);
      clearConfigIssues();
      resetVnextWorkspaceUi();
      useComponentFileTypesStore.getState().clearFileTypes();
      setError('Project could not be resolved.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProject = async () => {
      setLoading(true);
      setError(null);
      clearConfigIssues();

      try {
        const [projectResponse, treeResponse, statusResponse] = await Promise.all([
          getProject(projectId),
          getProjectTree(projectId),
          getProjectConfigStatus(projectId),
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
        applyConfigStatus(statusResponse);
        if (statusResponse.success && statusResponse.data.status === 'ok') {
          await Promise.all([
            refreshWorkspaceLayoutAndValidateScript(projectId),
            loadComponentFileTypes(projectId),
          ]);
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
        clearConfigIssues();
        resetVnextWorkspaceUi();
        useComponentFileTypesStore.getState().clearFileTypes();
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
  }, [
    applyConfigStatus,
    clearConfigIssues,
    projectId,
    setActiveProject,
    setError,
    setFileTree,
    setLoading,
    setVnextConfig,
    resetVnextWorkspaceUi,
  ]);

  return {
    reloadProjectWorkspace,
  };
}
