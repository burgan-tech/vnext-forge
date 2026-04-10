import { useCallback, useEffect } from 'react';
import { createLogger } from '@shared/lib/logger/CreateLogger';
import { useAsync } from '@shared/hooks/UseAsync';
import { saveComponentFile } from './SaveComponentApi';
import { useComponentStore } from './useComponentStore';

const logger = createLogger('save-component/useSaveComponent');

export function useSaveComponent() {
  const componentJson = useComponentStore((state) => state.componentJson);
  const filePath = useComponentStore((state) => state.filePath);
  const isDirty = useComponentStore((state) => state.isDirty);
  const markClean = useComponentStore((state) => state.markClean);

  const saveFile = useCallback(
    (nextFilePath: string, content: string) => saveComponentFile(nextFilePath, content),
    [],
  );

  const { execute, loading, error } = useAsync(saveFile, {
    showNotificationOnSuccess: true,
    showNotificationOnError: false,
    successMessage: 'Component saved.',
    errorMessage: 'Component could not be saved.',
    onSuccess: async () => {
      markClean();
    },
    onError: async (saveError) => {
      logger.error('Failed to save component', saveError);
    },
  });

  const save = useCallback(async () => {
    if (!componentJson || !filePath || !isDirty) return;
    await execute(filePath, JSON.stringify(componentJson, null, 2));
  }, [componentJson, execute, filePath, isDirty]);

  // Listen for Cmd+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return { save, isDirty, saving: loading, saveError: error };
}
