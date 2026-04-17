import { useCallback, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useAsync } from '../../hooks/useAsync';
import { createLogger } from '../../lib/logger/createLogger';
import { saveFlowEditorDocument } from './FlowEditorApi';

const logger = createLogger('flow-editor/useFlowEditorPersistence');

interface UseFlowEditorPersistenceOptions {
  group: string;
  name: string;
}

export function useFlowEditorPersistence({ group, name }: UseFlowEditorPersistenceOptions) {
  const { workflowJson, diagramJson, isDirty, markClean } = useWorkflowStore();
  const { activeProject, vnextConfig } = useProjectStore();

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

  const save = useCallback(async () => {
    if (!workflowJson || !diagramJson || !activeProject || !vnextConfig || !isDirty) {
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
  }, [activeProject, diagramJson, execute, group, isDirty, name, vnextConfig, workflowJson]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        void save();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return { isDirty, save, saving: loading, saveError: error };
}
