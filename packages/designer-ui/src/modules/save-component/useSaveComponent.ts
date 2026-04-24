import { useCallback } from 'react';
import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { saveComponentFile } from './SaveComponentApi';
import { useComponentStore } from '../../store/useComponentStore';

const logger = createLogger('save-component/useSaveComponent');

export interface UseSaveComponentOptions {
  /** JSON yazılmadan önce; `false` dönerse kayıt iptal */
  beforeSave?: () => Promise<boolean>;
}

export function useSaveComponent(options?: UseSaveComponentOptions) {
  const componentJson = useComponentStore((state) => state.componentJson);
  const filePath = useComponentStore((state) => state.filePath);
  const isDirty = useComponentStore((state) => state.isDirty);
  const markClean = useComponentStore((state) => state.markClean);
  const beforeSave = options?.beforeSave;

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
    if (beforeSave) {
      const ok = await beforeSave();
      if (!ok) return;
    }
    await execute(filePath, JSON.stringify(componentJson, null, 2));
  }, [beforeSave, componentJson, execute, filePath, isDirty]);

  useRegisterGlobalSaveShortcut(save);

  return { save, isDirty, saving: loading, saveError: error };
}
