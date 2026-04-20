import { useCallback, useEffect } from 'react';

import { createLogger, useProjectStore } from '@vnext-forge/designer-ui';
import { success, type ApiResponse } from '@vnext-forge/app-contracts';

import { useComponentFileTypesStore } from '../../../app/store/useComponentFileTypesStore';
import { useProjectListStore } from '../../../app/store/useProjectListStore';
import { useVnextWorkspaceUiStore } from '../../../app/store/useVnextWorkspaceUiStore';
import { useWorkspaceDiagnosticsStore } from '../../../app/store/useWorkspaceDiagnosticsStore';
import {
  getWorkspaceBootstrap,
  type ProjectWorkspaceBootstrap,
} from '../../project-management/ProjectApi';
import { applyProjectConfigStatus } from '../applyProjectConfigStatus';

const logger = createLogger('useProjectWorkspacePage');

export interface ProjectWorkspacePageController {
  reloadProjectWorkspace: () => Promise<void>;
}

/**
 * Proje çalışma alanı bootstrap: tek `projects.getWorkspaceBootstrap` RPC
 * çağrısı; sunucu projeyi, ağacı, config durumunu ve (config OK ise) layout +
 * validate script + component file types üçlüsünü tek seferde döner.
 *
 * Daha önce 6 ayrı RPC tetikliyorduk; React 19 StrictMode dev modda effect 2x
 * çalıştığı için bu sayı 12'ye çıkıyordu. Aggregation ile dev'de 2, prod'da 1
 * isteğe iniyor.
 */
export function useProjectWorkspacePage(projectId?: string): ProjectWorkspacePageController {
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setVnextConfig = useProjectStore((s) => s.setVnextConfig);
  const setLoading = useProjectStore((s) => s.setLoading);
  const setError = useProjectStore((s) => s.setError);
  const setFileTree = useProjectListStore((s) => s.setFileTree);
  const clearConfigIssues = useWorkspaceDiagnosticsStore((s) => s.clearConfigIssues);
  const resetVnextWorkspaceUi = useVnextWorkspaceUiStore((s) => s.resetVnextWorkspaceUi);

  const applyBootstrap = useCallback((bootstrap: ProjectWorkspaceBootstrap) => {
    const { setComponentLayoutStatus, setValidateScriptMissing } =
      useVnextWorkspaceUiStore.getState();

    setActiveProject(bootstrap.project);
    setFileTree(bootstrap.tree.root);
    applyProjectConfigStatus(success(bootstrap.configStatus), { openWizardOnMissing: true });

    if (bootstrap.configStatus.status === 'ok') {
      setComponentLayoutStatus(bootstrap.layoutStatus);
      setValidateScriptMissing(
        bootstrap.validateScriptStatus ? !bootstrap.validateScriptStatus.exists : false,
      );
      if (bootstrap.componentFileTypes) {
        useComponentFileTypesStore.getState().setFileTypes(bootstrap.componentFileTypes);
      } else {
        useComponentFileTypesStore.getState().clearFileTypes();
      }
    } else {
      setComponentLayoutStatus(null);
      setValidateScriptMissing(false);
      useComponentFileTypesStore.getState().clearFileTypes();
    }
  }, [setActiveProject, setFileTree]);

  const resetWorkspaceState = useCallback(
    (errorMessage: string | null) => {
      setActiveProject(null);
      setFileTree(null);
      setVnextConfig(null);
      clearConfigIssues();
      resetVnextWorkspaceUi();
      useComponentFileTypesStore.getState().clearFileTypes();
      if (errorMessage) {
        setError(errorMessage);
      }
    },
    [
      clearConfigIssues,
      resetVnextWorkspaceUi,
      setActiveProject,
      setError,
      setFileTree,
      setVnextConfig,
    ],
  );

  const fetchAndApplyBootstrap = useCallback(
    async (
      id: string,
      isCancelled: () => boolean,
    ): Promise<ApiResponse<ProjectWorkspaceBootstrap>> => {
      setLoading(true);
      setError(null);
      clearConfigIssues();

      try {
        const response = await getWorkspaceBootstrap(id);

        if (isCancelled()) {
          return response;
        }

        if (!response.success) {
          logger.error('Project workspace could not be loaded.', {
            error: response.error,
            projectId: id,
          });
          resetWorkspaceState('Project could not be loaded.');
          return response;
        }

        applyBootstrap(response.data);
        return response;
      } finally {
        if (!isCancelled()) {
          setLoading(false);
        }
      }
    },
    [applyBootstrap, clearConfigIssues, resetWorkspaceState, setError, setLoading],
  );

  const reloadProjectWorkspace = useCallback(async () => {
    if (!projectId) {
      return;
    }
    await fetchAndApplyBootstrap(projectId, () => false);
  }, [fetchAndApplyBootstrap, projectId]);

  useEffect(() => {
    if (!projectId) {
      resetWorkspaceState('Project could not be resolved.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    void fetchAndApplyBootstrap(projectId, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [fetchAndApplyBootstrap, projectId, resetWorkspaceState, setLoading]);

  return {
    reloadProjectWorkspace,
  };
}
