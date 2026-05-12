import { useCallback } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedAutoSave } from '../../hooks/useDebouncedAutoSave';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { useSettingsStore } from '../../store/useSettingsStore';
import { createLogger } from '../../lib/logger/createLogger';
import { showNotification } from '../../notification/notification-port';
import { persistDiagramSnapshot, saveWorkflowDocument } from './FlowEditorApi';
import { validateWorkflowBeforeWrite } from '../save-component/validateBeforeWrite';

const logger = createLogger('flow-editor/useFlowEditorPersistence');

interface UseFlowEditorPersistenceOptions {
  group: string;
  name: string;
}

export function useFlowEditorPersistence({ group, name }: UseFlowEditorPersistenceOptions) {
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const markClean = useWorkflowStore((s) => s.markClean);
  const workflowJson = useWorkflowStore((s) => s.workflowJson);
  const autoSaveEnabled = useSettingsStore((s) => s.autoSaveEnabled);

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

    const workflowDir = group
      ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.workflows}/${group}`
      : `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.workflows}`;
    const diagramFilePath = `${workflowDir}/.meta/${name}.diagram.json`;

    // Non-blocking: warn on validation failure but still proceed with save.
    const gate = await validateWorkflowBeforeWrite(workflowJson, vnextConfig.schemaVersion);
    const hasValidationIssues = !gate.valid && !gate.skipped;

    await execute({
      workflowDir,
      workflowFilePath: `${workflowDir}/${name}.json`,
      workflowJson,
    });

    if (hasValidationIssues) {
      const count = gate.errors.length;
      showNotification({
        kind: 'warning',
        message: `Workflow saved with ${count} validation issue${count > 1 ? 's' : ''}`,
        durationMs: 10_000,
      });
      logger.warn('Workflow saved with validation warnings', { errors: gate.errors });
    }

    void persistDiagramSnapshot(diagramFilePath, diagramJson);
  }, [execute, group, name]);

  const { autoSavePending, autoSaved, cancelAutoSave } = useDebouncedAutoSave({
    isDirty,
    saving: loading,
    save,
    enabled: autoSaveEnabled,
    changeSignal: workflowJson,
  });

  const manualSave = useCallback(async () => {
    cancelAutoSave();
    await save();
  }, [cancelAutoSave, save]);

  useRegisterGlobalSaveShortcut(manualSave);

  return { isDirty, save: manualSave, saving: loading, saveError: error, autoSavePending, autoSaved };
}
