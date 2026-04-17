import { useCallback, useEffect } from 'react';
import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { loadSchemaEditor, saveSchemaEditor } from './SchemaEditorApi';
import { useSchemaEditorStore } from './useSchemaEditorStore';

const logger = createLogger('schema-editor/useSchemaEditor');

interface UseSchemaEditorParams {
  filePath: string | null;
}

export function useSchemaEditor({ filePath }: UseSchemaEditorParams) {
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
