import { useEffect, useCallback } from 'react';
import { createLogger } from '@shared/lib/logger/CreateLogger';
import { writeFile } from '@modules/project-workspace/WorkspaceApi';
import { useComponentStore } from './ComponentStore';

const logger = createLogger('save-component/useSaveComponent');

export function useSaveComponent() {
  const { componentJson, filePath, isDirty, markClean } = useComponentStore();

  const save = useCallback(async () => {
    if (!componentJson || !filePath || !isDirty) return;

    try {
      await writeFile(filePath, JSON.stringify(componentJson, null, 2));
      markClean();
    } catch (err) {
      logger.error('Failed to save component', err);
    }
  }, [componentJson, filePath, isDirty, markClean]);

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

  return { save, isDirty };
}
