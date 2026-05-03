import { useCallback } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useAsync } from '../../hooks/useAsync';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { createLogger } from '../../lib/logger/createLogger';
import { persistDiagramSnapshot, saveWorkflowDocument } from './FlowEditorApi';

const logger = createLogger('flow-editor/useFlowEditorPersistence');

interface UseFlowEditorPersistenceOptions {
  group: string;
  name: string;
}

export function useFlowEditorPersistence({ group, name }: UseFlowEditorPersistenceOptions) {
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const markClean = useWorkflowStore((s) => s.markClean);

  const { execute, loading, error } = useAsync(saveWorkflowDocument, {
    showNotificationOnSuccess: false,
    showNotificationOnError: false,
    errorMessage: 'Workflow could not be saved.',
    onSuccess: async () => {
      markClean();
    },
    onError: async (saveError) => {
      logger.error('Failed to save workflow', saveError);
    },
  });

  /**
   * `workflowJson` / `diagramJson` change on every edit; binding `save` to
   * them would retrigger `ComponentEditorLayout` + `registerToolbar`'s
   * `useLayoutEffect` on every update, causing an infinite `setToolbar` loop.
   * Use `getState()` for a point-in-time snapshot instead.
   */
  const save = useCallback(async () => {
    const { workflowJson, diagramJson, isDirty: dirty } = useWorkflowStore.getState();
    const { activeProject, vnextConfig } = useProjectStore.getState();
    if (!workflowJson || !diagramJson || !activeProject || !vnextConfig || !dirty) {
      return;
    }

    const workflowDir = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.workflows}/${group}`;
    const diagramFilePath = `${workflowDir}/.meta/${name}.diagram.json`;

    await execute({
      workflowDir,
      workflowFilePath: `${workflowDir}/${name}.json`,
      workflowJson,
    });

    void persistDiagramSnapshot(diagramFilePath, diagramJson);
  }, [execute, group, name]);

  useRegisterGlobalSaveShortcut(save);

  return { isDirty, save, saving: loading, saveError: error };
}
