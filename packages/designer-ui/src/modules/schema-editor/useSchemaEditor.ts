import { useCallback, useEffect } from 'react';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { useDebouncedAutoSave } from '../../hooks/useDebouncedAutoSave';
import { createLogger } from '../../lib/logger/createLogger';
import { showNotification } from '../../notification/notification-port';
import { useAsync } from '../../hooks/useAsync';
import { loadSchemaEditor, saveSchemaEditor } from './SchemaEditorApi';
import { useSchemaEditorStore } from './useSchemaEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useComponentStore } from '../../store/useComponentStore';
import { validateComponentBeforeWrite } from '../save-component/validateBeforeWrite';

const logger = createLogger('schema-editor/useSchemaEditor');

interface UseSchemaEditorParams {
  filePath: string | null;
  /** After a successful save and `markClean()`. */
  onSaveSuccess?: () => void;
}

export function useSchemaEditor({ filePath, onSaveSuccess }: UseSchemaEditorParams) {
  const componentJson = useSchemaEditorStore((state) => state.componentJson);
  const componentFilePath = useSchemaEditorStore((state) => state.filePath);
  const isDirty = useSchemaEditorStore((state) => state.isDirty);
  const markClean = useSchemaEditorStore((state) => state.markClean);
  const setComponent = useSchemaEditorStore((state) => state.setComponent);
  const clear = useSchemaEditorStore((state) => state.clear);
  const autoSaveEnabled = useSettingsStore((state) => state.autoSaveEnabled);
  const schemaVersion = useProjectStore((state) => state.vnextConfig?.schemaVersion);

  const {
    execute: executeLoad,
    loading,
    error,
    data,
    reset,
  } = useAsync(loadSchemaEditor, {
    showNotificationOnError: false,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      setComponent(result.data.json, result.data.filePath);
    },
  });

  const {
    execute: executeSave,
    loading: saving,
    error: saveError,
  } = useAsync(saveSchemaEditor, {
    showNotificationOnSuccess: true,
    showNotificationOnError: false,
    successMessage: 'Schema saved.',
    errorMessage: 'Schema could not be saved.',
    onSuccess: async () => {
      markClean();
      onSaveSuccess?.();
    },
    onError: async (nextError) => {
      logger.error('Failed to save schema', nextError);
    },
  });

  useEffect(() => {
    if (!filePath) {
      reset();
      clear();
      return;
    }

    clear();
    void executeLoad({ filePath });
  }, [clear, executeLoad, filePath, reset]);

  const save = useCallback(async () => {
    if (!componentJson || !componentFilePath || !isDirty) {
      return;
    }

    const gate = await validateComponentBeforeWrite(componentJson, 'schema', schemaVersion);
    if (!gate.valid && !gate.skipped) {
      useComponentStore.getState().setValidationErrors(
        gate.errors.map((e) => ({ path: e.path, message: e.message })),
      );
      const count = gate.errors.length;
      showNotification({
        kind: 'error',
        message: `Validation failed — ${count} issue${count > 1 ? 's' : ''}`,
        durationMs: 30_000,
        action: {
          label: 'View issues',
          onPress: () => {
            const el = document.getElementById('component-validation-summary');
            el?.scrollIntoView({ behavior: 'smooth' });
            el?.focus();
          },
        },
      });
      logger.warn('Schema save blocked by validation', { errors: gate.errors });
      return;
    }

    useComponentStore.getState().clearValidationErrors();

    await executeSave({
      filePath: componentFilePath,
      json: componentJson,
    });
  }, [componentFilePath, componentJson, executeSave, isDirty, schemaVersion]);

  const { autoSavePending, autoSaved, cancelAutoSave } = useDebouncedAutoSave({
    isDirty,
    saving,
    save,
    enabled: autoSaveEnabled,
    changeSignal: componentJson,
  });

  const manualSave = useCallback(async () => {
    cancelAutoSave();
    await save();
  }, [cancelAutoSave, save]);

  useRegisterGlobalSaveShortcut(manualSave);

  const isReady = Boolean(data && componentJson && componentFilePath === filePath);

  return {
    loading,
    error,
    isReady,
    save: manualSave,
    saving,
    saveError,
    autoSavePending,
    autoSaved,
  };
}
