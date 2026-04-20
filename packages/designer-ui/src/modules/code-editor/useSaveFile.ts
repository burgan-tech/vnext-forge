import { useCallback } from 'react';
import { createLogger } from '../../lib/logger/createLogger';
import { useAsync } from '../../hooks/useAsync';
import { useRegisterGlobalSaveShortcut } from '../../hooks/useRegisterGlobalSaveShortcut';
import { writeCodeEditorFile } from './CodeEditorApi';

const logger = createLogger('code-editor/useSaveFile');

interface UseSaveFileOptions {
  filePath: string | null;
  getContent: () => string | null;
  onSaved?: () => void;
  isDirty: boolean;
}

export function useSaveFile({ filePath, getContent, onSaved, isDirty }: UseSaveFileOptions) {
  const saveFile = useCallback(
    (nextFilePath: string, content: string) => writeCodeEditorFile(nextFilePath, content),
    [],
  );

  const { execute, loading, error } = useAsync(saveFile, {
    showNotificationOnError: false,
    errorMessage: 'File could not be saved.',
    onSuccess: async () => {
      onSaved?.();
    },
    onError: async (saveError) => {
      logger.error('Failed to save file', saveError);
    },
  });

  const save = useCallback(async () => {
    if (!filePath || !isDirty) return;
    const content = getContent();
    if (content === null) return;

    await execute(filePath, content);
  }, [execute, filePath, getContent, isDirty]);

  useRegisterGlobalSaveShortcut(save);

  return { save, saveError: error, saving: loading };
}
