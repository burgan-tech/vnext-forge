import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  getProject,
  getProjectConfigStatus,
  getVnextComponentLayoutStatus,
} from '@modules/project-management/ProjectApi';
import { useProjectStore } from '@app/store/useProjectStore';
import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';
import { useWorkspaceDiagnosticsStore } from '@app/store/useWorkspaceDiagnosticsStore';
import { createLogger } from '@shared/lib/logger/CreateLogger';

import { applyComponentLayoutSeedOffer } from '../applyComponentLayoutSeedOffer';
import { applyProjectConfigStatus } from '../applyProjectConfigStatus';
import { getProjectTree } from '../WorkspaceApi';

const logger = createLogger('useProjectWorkspacePage');

export interface ProjectWorkspacePageController {
  vnextConfigWizardOpen: boolean;
  setVnextConfigWizardOpen: (open: boolean) => void;
  reloadProjectWorkspace: () => Promise<void>;
  handleWizardCompleted: (nextProjectId: string) => Promise<void>;
}

/**
 * Proje çalışma alanı bootstrap: proje meta + config `ProjectApi`, ağaç `WorkspaceApi`.
 */
export function useProjectWorkspacePage(projectId?: string): ProjectWorkspacePageController {
  const navigate = useNavigate();
  const { setActiveProject, setError, setFileTree, setLoading, setVnextConfig } = useProjectStore();
  const { clearConfigIssues } = useWorkspaceDiagnosticsStore();
  const vnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.vnextConfigWizardOpen);
  const setVnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.setVnextConfigWizardOpen);
  const resetVnextWorkspaceUi = useVnextWorkspaceUiStore((s) => s.resetVnextWorkspaceUi);
  /** Ana yüklemeden ayrı: hata fırlatırsa workspace (ağaç dahil) sıfırlanmamalı. */
  const offerLayoutSeedIfNeeded = useCallback(
    async (pid: string, ignoreTemplateDecline: boolean) => {
      try {
        const layoutRes = await getVnextComponentLayoutStatus(pid);
        if (!layoutRes.success) {
          return;
        }
        applyComponentLayoutSeedOffer(layoutRes.data, {
          activeProjectId: pid,
          ignoreTemplateDecline,
        });
      } catch (error) {
        logger.warn('Bileşen layout teklifi atlandı (ağaç yine de yüklü).', { error, projectId: pid });
      }
    },
    [],
  );

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
        await offerLayoutSeedIfNeeded(projectId, false);
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
      setError('Project could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [
    applyConfigStatus,
    clearConfigIssues,
    offerLayoutSeedIfNeeded,
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
          await offerLayoutSeedIfNeeded(projectId, false);
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
    offerLayoutSeedIfNeeded,
    projectId,
    setActiveProject,
    setError,
    setFileTree,
    setLoading,
    setVnextConfig,
    resetVnextWorkspaceUi,
  ]);

  const handleWizardCompleted = useCallback(
    async (nextProjectId: string) => {
      await reloadProjectWorkspace();
      if (nextProjectId !== projectId) {
        navigate(`/project/${nextProjectId}`, { replace: true });
      }
    },
    [navigate, projectId, reloadProjectWorkspace],
  );

  return {
    vnextConfigWizardOpen,
    setVnextConfigWizardOpen,
    reloadProjectWorkspace,
    handleWizardCompleted,
  };
}
