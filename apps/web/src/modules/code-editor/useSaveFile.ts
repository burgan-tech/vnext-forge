import { useEffect, useCallback } from 'react';
import { createLogger } from '@shared/lib/logger/createLogger';
import { writeFile } from '@modules/project-workspace/workspace-api';

const logger = createLogger('code-editor/useSaveFile');

interface UseSaveFileOptions {
  filePath: string | null;
  getContent: () => string | null;
  onSaved?: () => void;
  isDirty: boolean;
}

export function useSaveFile({ filePath, getContent, onSaved, isDirty }: UseSaveFileOptions) {
  const save = useCallback(async () => {
    if (!filePath || !isDirty) return;
    const content = getContent();
    if (content === null) return;

    try {
      await writeFile(filePath, content);
      onSaved?.();
    } catch (err) {
      logger.error('Failed to save file', err);
    }
  }, [filePath, getContent, onSaved, isDirty]);

  // Listen for Cmd+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return { save };
}
