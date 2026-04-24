import { useCallback, useEffect } from 'react';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { loadSchemaEditor, saveSchemaEditor } from './SchemaEditorApi';
import { useSchemaEditorStore } from './useSchemaEditorStore';

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

    await executeSave({
      filePath: componentFilePath,
      json: componentJson,
    });
  }, [componentFilePath, componentJson, executeSave, isDirty]);

  useRegisterGlobalSaveShortcut(save);

  const isReady = Boolean(data && componentJson && componentFilePath === filePath);

  return {
    loading,
    error,
    isReady,
    save,
    saving,
    saveError,
  };
}
