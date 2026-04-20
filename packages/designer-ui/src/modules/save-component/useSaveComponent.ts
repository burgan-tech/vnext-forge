import { useCallback } from 'react';
import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { saveComponentFile } from './SaveComponentApi';
import { useComponentStore } from '../../store/useComponentStore';

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

  useRegisterGlobalSaveShortcut(save);

  return { save, isDirty, saving: loading, saveError: error };
}
