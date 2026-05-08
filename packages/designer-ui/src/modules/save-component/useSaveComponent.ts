import { useCallback } from 'react';
import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedAutoSave } from '../../hooks/useDebouncedAutoSave';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { saveComponentFile } from './SaveComponentApi';
import { useComponentStore } from '../../store/useComponentStore';
import { useSettingsStore } from '../../store/useSettingsStore';

const logger = createLogger('save-component/useSaveComponent');

export interface UseSaveComponentOptions {
  /** Return false to cancel the save. */
  beforeSave?: () => Promise<boolean>;
  /** Called after a successful write and `markClean()`. */
  afterSaveSuccess?: () => void;
}

export function useSaveComponent(options?: UseSaveComponentOptions) {
  const componentJson = useComponentStore((state) => state.componentJson);
  const filePath = useComponentStore((state) => state.filePath);
  const isDirty = useComponentStore((state) => state.isDirty);
  const markClean = useComponentStore((state) => state.markClean);
  const autoSaveEnabled = useSettingsStore((state) => state.autoSaveEnabled);
  const beforeSave = options?.beforeSave;
  const afterSaveSuccess = options?.afterSaveSuccess;

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
      afterSaveSuccess?.();
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

  const { autoSavePending, autoSaved, cancelAutoSave } = useDebouncedAutoSave({
    isDirty,
    saving: loading,
    save,
    enabled: autoSaveEnabled,
    changeSignal: componentJson,
  });

  const manualSave = useCallback(async () => {
    cancelAutoSave();
    await save();
  }, [cancelAutoSave, save]);

  useRegisterGlobalSaveShortcut(manualSave);

  return { save: manualSave, isDirty, saving: loading, saveError: error, autoSavePending, autoSaved };
}
