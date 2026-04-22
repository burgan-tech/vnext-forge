import { useCallback } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useAsync } from '../../hooks/useAsync';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { createLogger } from '../../lib/logger/createLogger';
import { saveFlowEditorDocument } from './FlowEditorApi';

const logger = createLogger('flow-editor/useFlowEditorPersistence');

interface UseFlowEditorPersistenceOptions {
  group: string;
  name: string;
}

export function useFlowEditorPersistence({ group, name }: UseFlowEditorPersistenceOptions) {
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const markClean = useWorkflowStore((s) => s.markClean);

  const { execute, loading, error } = useAsync(saveFlowEditorDocument, {
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
   * `workflowJson` / `diagramJson` her düzenlemede değişir; `save`'i buna
   * bağımlı tutmak `ComponentEditorLayout` + `registerToolbar` içindeki
   * `useLayoutEffect`'i her güncellemede tetikleyip üstte `setToolbar` ile
   * sonsuz güncelleme döngüsüne yol açabiliyor. Anlık snapshot için
   * `getState()` kullan.
   */
  const save = useCallback(async () => {
    const { workflowJson, diagramJson, isDirty: dirty } = useWorkflowStore.getState();
    const { activeProject, vnextConfig } = useProjectStore.getState();
    if (!workflowJson || !diagramJson || !activeProject || !vnextConfig || !dirty) {
      return;
    }

    const workflowDir = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.workflows}/${group}`;

    await execute({
      workflowDir,
      workflowFilePath: `${workflowDir}/${name}.json`,
      diagramFilePath: `${workflowDir}/.meta/${name}.diagram.json`,
      workflowJson,
      diagramJson,
    });
  }, [execute, group, name]);

  useRegisterGlobalSaveShortcut(save);

  return { isDirty, save, saving: loading, saveError: error };
}
